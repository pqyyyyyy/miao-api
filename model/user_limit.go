package model

import (
	"errors"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/samber/hot"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	MaxUserUsageRules         = 10
	MaxUserConcurrencyLimit   = 1000
	MinUserUsageWindowSeconds = int64(3600)
	MaxUserUsageWindowSeconds = int64(90 * 24 * 3600)

	userLimitSnapshotCacheTTL      = 30 * time.Second
	userLimitSnapshotCacheCapacity = 100000
	userUsageWindowUpdateAttempts  = 3
)

// UserLimitPolicy is the administrator-configured usage limit rules and
// concurrency cap of one user. Users cannot write it, which is why it does not
// live in users.setting.
type UserLimitPolicy struct {
	Id             int    `json:"id" gorm:"primaryKey"`
	UserId         int    `json:"user_id" gorm:"not null;uniqueIndex"`
	MaxConcurrency int    `json:"max_concurrency" gorm:"not null;default:0"`
	UsageRules     string `json:"-" gorm:"type:text"` // JSON: []UserUsageRule
	UpdatedAt      int64  `json:"updated_at" gorm:"bigint"`
}

func (UserLimitPolicy) TableName() string {
	return "user_limit_policies"
}

// UserUsageRule caps the quota a user may consume within one fixed window.
// WindowSeconds identifies the rule: it is unique per user and keys the window
// state, so changing only QuotaLimit or Enabled keeps the current window.
type UserUsageRule struct {
	WindowSeconds int64 `json:"window_seconds"`
	QuotaLimit    int64 `json:"quota_limit"`
	Enabled       bool  `json:"enabled"`
}

// UserUsageWindow is the fixed-window state of one rule window. A window opens
// with the first charged settlement after the previous one expired, and its
// usage is discarded as a whole once WindowStart+WindowSeconds has passed.
// WindowStart 0 means the window has not started.
type UserUsageWindow struct {
	Id            int64 `json:"id" gorm:"primaryKey"`
	UserId        int   `json:"user_id" gorm:"not null;uniqueIndex:idx_user_usage_window,priority:1"`
	WindowSeconds int64 `json:"window_seconds" gorm:"not null;uniqueIndex:idx_user_usage_window,priority:2"`
	WindowStart   int64 `json:"window_start" gorm:"not null;default:0"`
	UsedQuota     int64 `json:"used_quota" gorm:"not null;default:0"`
	UpdatedAt     int64 `json:"updated_at" gorm:"bigint"`
}

func (UserUsageWindow) TableName() string {
	return "user_usage_windows"
}

// IsActive reports whether the window has started and not yet expired at now.
func (w *UserUsageWindow) IsActive(now int64) bool {
	return w.WindowStart > 0 && w.WindowStart+w.WindowSeconds > now
}

// UserLimitSnapshot is the parsed policy of one user. The zero value means the
// user has no policy.
type UserLimitSnapshot struct {
	MaxConcurrency int             `json:"max_concurrency"`
	Rules          []UserUsageRule `json:"usage_rules"`
	UpdatedAt      int64           `json:"updated_at"`
}

func (s UserLimitSnapshot) HasEnabledRule() bool {
	for _, rule := range s.Rules {
		if rule.Enabled {
			return true
		}
	}
	return false
}

var (
	userLimitSnapshotCacheOnce sync.Once
	userLimitSnapshotCache     *hot.HotCache[int, UserLimitSnapshot]
)

// The snapshot cache is process-local on purpose: every relay request and
// every settlement looks the policy up, including for users without one, so
// the lookup must stay a memory read. Other instances see a change within the
// cache TTL.
func getUserLimitSnapshotCache() *hot.HotCache[int, UserLimitSnapshot] {
	userLimitSnapshotCacheOnce.Do(func() {
		userLimitSnapshotCache = hot.NewHotCache[int, UserLimitSnapshot](hot.LRU, userLimitSnapshotCacheCapacity).
			WithTTL(userLimitSnapshotCacheTTL).
			WithJanitor().
			Build()
	})
	return userLimitSnapshotCache
}

// GetUserLimitSnapshot returns the cached policy of a user. Users without a
// policy are cached as the zero snapshot.
func GetUserLimitSnapshot(userId int) (UserLimitSnapshot, error) {
	if userId <= 0 {
		return UserLimitSnapshot{}, nil
	}
	cache := getUserLimitSnapshotCache()
	if snapshot, found, err := cache.Get(userId); err == nil && found {
		return snapshot, nil
	}
	var policy UserLimitPolicy
	if err := DB.Where("user_id = ?", userId).Limit(1).Find(&policy).Error; err != nil {
		return UserLimitSnapshot{}, err
	}
	snapshot := UserLimitSnapshot{}
	if policy.Id != 0 {
		snapshot.MaxConcurrency = policy.MaxConcurrency
		snapshot.UpdatedAt = policy.UpdatedAt
		if policy.UsageRules != "" {
			if err := common.UnmarshalJsonStr(policy.UsageRules, &snapshot.Rules); err != nil {
				return UserLimitSnapshot{}, err
			}
		}
	}
	cache.Set(userId, snapshot)
	return snapshot, nil
}

func InvalidateUserLimitSnapshot(userId int) {
	getUserLimitSnapshotCache().Delete(userId)
}

// SaveUserLimitPolicy replaces the policy of a user. Window state of removed
// windows is deleted, new windows start idle, and existing windows keep their
// state. An empty policy deletes the policy and all window state.
func SaveUserLimitPolicy(userId int, maxConcurrency int, rules []UserUsageRule) error {
	if userId <= 0 {
		return errors.New("invalid user id")
	}
	windows := make([]int64, 0, len(rules))
	for _, rule := range rules {
		windows = append(windows, rule.WindowSeconds)
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		staleWindows := tx.Where("user_id = ?", userId)
		if len(windows) > 0 {
			staleWindows = staleWindows.Where("window_seconds NOT IN ?", windows)
		}
		if err := staleWindows.Delete(&UserUsageWindow{}).Error; err != nil {
			return err
		}
		if maxConcurrency <= 0 && len(rules) == 0 {
			return tx.Where("user_id = ?", userId).Delete(&UserLimitPolicy{}).Error
		}
		rulesJSON, err := common.Marshal(rules)
		if err != nil {
			return err
		}
		policy := UserLimitPolicy{
			UserId:         userId,
			MaxConcurrency: maxConcurrency,
			UsageRules:     string(rulesJSON),
			UpdatedAt:      common.GetTimestamp(),
		}
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"max_concurrency", "usage_rules", "updated_at"}),
		}).Create(&policy).Error; err != nil {
			return err
		}
		if len(windows) == 0 {
			return nil
		}
		rows := make([]UserUsageWindow, 0, len(windows))
		for _, windowSeconds := range windows {
			rows = append(rows, UserUsageWindow{UserId: userId, WindowSeconds: windowSeconds})
		}
		return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error
	})
	if err != nil {
		return err
	}
	InvalidateUserLimitSnapshot(userId)
	return nil
}

func GetUserUsageWindows(userId int) ([]UserUsageWindow, error) {
	var windows []UserUsageWindow
	err := DB.Where("user_id = ?", userId).Find(&windows).Error
	return windows, err
}

// ResetUserUsageWindows ends the current windows of a user so the next charged
// settlement opens new ones. windowSeconds 0 resets every window.
func ResetUserUsageWindows(userId int, windowSeconds int64) error {
	query := DB.Model(&UserUsageWindow{}).Where("user_id = ?", userId)
	if windowSeconds > 0 {
		query = query.Where("window_seconds = ?", windowSeconds)
	}
	return query.Updates(map[string]any{"window_start": 0, "used_quota": 0}).Error
}

// RecordUserUsageWindows adds settled quota to the usage windows of a user
// that has usage rules; refunds pass a negative quota. Disabled rules are
// recorded too, so enabling a rule again keeps its current window. Failures are
// logged and never change the charge itself.
func RecordUserUsageWindows(userId int, quota int) {
	if userId <= 0 || quota == 0 {
		return
	}
	snapshot, err := GetUserLimitSnapshot(userId)
	if err != nil {
		common.SysError(common.LogText("failed to load user limit policy: user %d, %s", userId, err.Error()))
		return
	}
	if len(snapshot.Rules) == 0 {
		return
	}
	now := common.GetTimestamp()
	for _, rule := range snapshot.Rules {
		if err := addUserUsageWindowQuota(userId, rule.WindowSeconds, int64(quota), now); err != nil {
			common.SysError(common.LogText("failed to record user usage window: user %d, window %d, %s", userId, rule.WindowSeconds, err.Error()))
		}
	}
}

func userUsageWindowQuery(userId int, windowSeconds int64) *gorm.DB {
	return DB.Model(&UserUsageWindow{}).Where("user_id = ? AND window_seconds = ?", userId, windowSeconds)
}

// addUserUsageWindowQuota applies one delta with single-statement conditional
// updates instead of SELECT ... FOR UPDATE: SQLite has no row locks, and a
// read-then-write transaction there can lose updates under concurrency. Every
// statement sets either one column or constants only, so the result does not
// depend on the order in which the database evaluates SET assignments. State
// rows are created when the policy is saved, never here.
func addUserUsageWindowQuota(userId int, windowSeconds int64, delta int64, now int64) error {
	const activeCondition = "window_start > 0 AND window_start + window_seconds > ?"
	if delta < 0 {
		// A refund only lowers the window it may belong to; once that window
		// has ended, the charge it refunds no longer counts anywhere.
		return userUsageWindowQuery(userId, windowSeconds).
			Where(activeCondition, now).
			Update("used_quota", gorm.Expr("CASE WHEN used_quota + ? > 0 THEN used_quota + ? ELSE 0 END", delta, delta)).Error
	}
	for range userUsageWindowUpdateAttempts {
		result := userUsageWindowQuery(userId, windowSeconds).
			Where(activeCondition, now).
			Update("used_quota", gorm.Expr("used_quota + ?", delta))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected > 0 {
			return nil
		}
		result = userUsageWindowQuery(userId, windowSeconds).
			Where("(window_start = 0 OR window_start + window_seconds <= ?)", now).
			Updates(map[string]any{"window_start": now, "used_quota": delta})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected > 0 {
			return nil
		}
		// Neither statement matched: another settlement opened the window
		// between them, or the row is gone because an administrator removed
		// the rule while this instance still caches the old policy.
	}
	return nil
}
