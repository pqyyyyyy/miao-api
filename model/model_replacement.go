package model

import (
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const (
	ModelReplacementVerdictPassed   = "passed"
	ModelReplacementVerdictReplaced = "replaced"
	ModelReplacementVerdictFailed   = "failed"
)

// ModelReplacementAppliedAction records one configured action as it ran on a
// channel; Changed is false when the channel already matched it.
type ModelReplacementAppliedAction struct {
	Type    string `json:"type"`
	Value   string `json:"value"`
	Amount  int64  `json:"amount"`
	Changed bool   `json:"changed"`
}

// ModelReplacementModelStat summarizes one detected model of one channel in
// one detection run. Percentages are 0-100 over all rounds of that model.
type ModelReplacementModelStat struct {
	Model           string  `json:"model"`
	Total           int     `json:"total"`
	Matched         int     `json:"matched"`
	Mismatched      int     `json:"mismatched"`
	Failed          int     `json:"failed"`
	MatchPercent    float64 `json:"match_percent"`
	MismatchPercent float64 `json:"mismatch_percent"`
	Verdict         string  `json:"verdict"`
}

// ModelReplacementRecord is the outcome of one detection run for one channel.
type ModelReplacementRecord struct {
	ID          int64  `json:"id" gorm:"primaryKey"`
	RunID       string `json:"run_id" gorm:"type:varchar(64);index"`
	ChannelID   int    `json:"channel_id" gorm:"index:idx_model_replacement_records_channel,priority:1"`
	ChannelName string `json:"channel_name" gorm:"type:varchar(255)"`
	Verdict     string `json:"verdict" gorm:"type:varchar(16)"`
	// MatchPercent is the lowest match percentage across the channel's models.
	MatchPercent float64 `json:"match_percent"`
	// Actions is the JSON list of ModelReplacementAppliedAction that ran.
	Actions      string `json:"-" gorm:"type:text"`
	ErrorMessage string `json:"error_message" gorm:"type:text"`
	ModelStats   string `json:"-" gorm:"type:text"`
	AvgLatencyMs int64  `json:"avg_latency_ms" gorm:"bigint"`
	StartedAt    int64  `json:"started_at" gorm:"bigint"`
	FinishedAt   int64  `json:"finished_at" gorm:"bigint"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint;index;index:idx_model_replacement_records_channel,priority:2"`
}

// ModelReplacementAttempt is one detection request (with its retries) for one
// model in one round.
type ModelReplacementAttempt struct {
	ID           int64  `json:"id" gorm:"primaryKey"`
	RecordID     int64  `json:"record_id" gorm:"index"`
	Model        string `json:"model" gorm:"type:varchar(255)"`
	Round        int    `json:"round" gorm:"column:round_index"`
	Tries        int    `json:"tries"`
	Success      bool   `json:"success"`
	Matched      bool   `json:"matched"`
	Answer       string `json:"answer" gorm:"type:text"`
	ErrorMessage string `json:"error_message" gorm:"type:text"`
	LatencyMs    int64  `json:"latency_ms" gorm:"bigint"`
	TestedAt     int64  `json:"tested_at" gorm:"bigint"`
}

// ModelReplacementRecordView is the API shape of a record with decoded stats.
type ModelReplacementRecordView struct {
	ModelReplacementRecord
	Models  []ModelReplacementModelStat     `json:"models"`
	Actions []ModelReplacementAppliedAction `json:"actions"`
}

func (record *ModelReplacementRecord) View() ModelReplacementRecordView {
	view := ModelReplacementRecordView{
		ModelReplacementRecord: *record,
		Models:                 []ModelReplacementModelStat{},
		Actions:                []ModelReplacementAppliedAction{},
	}
	if record.ModelStats != "" {
		if err := common.UnmarshalJsonStr(record.ModelStats, &view.Models); err != nil {
			common.SysError(common.LogText("failed to decode model replacement stats: record_id=%d, error=%v", record.ID, err))
		}
	}
	if record.Actions != "" {
		if err := common.UnmarshalJsonStr(record.Actions, &view.Actions); err != nil {
			common.SysError(common.LogText("failed to decode model replacement actions: record_id=%d, error=%v", record.ID, err))
		}
	}
	return view
}

// CreateModelReplacementRecord stores a channel result together with its
// attempts so a report never shows a result without its details.
func CreateModelReplacementRecord(record *ModelReplacementRecord, attempts []ModelReplacementAttempt) error {
	if record.CreatedAt == 0 {
		record.CreatedAt = common.GetTimestamp()
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(record).Error; err != nil {
			return err
		}
		if len(attempts) == 0 {
			return nil
		}
		for i := range attempts {
			attempts[i].RecordID = record.ID
		}
		return tx.CreateInBatches(attempts, 100).Error
	})
}

// GetLatestModelReplacementRecords returns the newest record of every channel
// that has been detected at least once.
func GetLatestModelReplacementRecords() ([]*ModelReplacementRecord, error) {
	var records []*ModelReplacementRecord
	latestIDs := DB.Model(&ModelReplacementRecord{}).Select("MAX(id)").Group("channel_id")
	err := DB.Where("id IN (?)", latestIDs).Find(&records).Error
	return records, err
}

// GetModelReplacementHistory returns records created between start and end
// (Unix seconds, inclusive) in chronological order, for one channel or, with
// channelID 0, for every channel. Records of deleted channels are left out.
// When more than limit records match, the most recent limit are returned.
func GetModelReplacementHistory(channelID int, start int64, end int64, limit int) ([]*ModelReplacementRecord, error) {
	query := DB.Where("created_at >= ? AND created_at <= ?", start, end).
		Where("channel_id IN (?)", DB.Model(&Channel{}).Select("id"))
	if channelID > 0 {
		query = query.Where("channel_id = ?", channelID)
	}
	var records []*ModelReplacementRecord
	if err := query.Order("id desc").Limit(limit).Find(&records).Error; err != nil {
		return nil, err
	}
	slices.Reverse(records)
	return records, nil
}

func GetModelReplacementRecord(id int64) (*ModelReplacementRecord, error) {
	var record ModelReplacementRecord
	if err := DB.First(&record, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

func GetModelReplacementAttempts(recordID int64) ([]*ModelReplacementAttempt, error) {
	var attempts []*ModelReplacementAttempt
	err := DB.Where("record_id = ?", recordID).Order("id asc").Find(&attempts).Error
	return attempts, err
}

// PurgeModelReplacementRecords removes, along with their attempts, the records
// created before the timestamp and every record of a channel that has been
// deleted, so a deleted channel leaves no detection history behind.
func PurgeModelReplacementRecords(before int64) error {
	const purgedCondition = "created_at < ? OR channel_id NOT IN (?)"
	return DB.Transaction(func(tx *gorm.DB) error {
		purgedIDs := tx.Model(&ModelReplacementRecord{}).Select("id").
			Where(purgedCondition, before, tx.Model(&Channel{}).Select("id"))
		if err := tx.Where("record_id IN (?)", purgedIDs).Delete(&ModelReplacementAttempt{}).Error; err != nil {
			return err
		}
		return tx.Where(purgedCondition, before, tx.Model(&Channel{}).Select("id")).Delete(&ModelReplacementRecord{}).Error
	})
}

// UpdateChannelGroup replaces a channel's group list in one transaction and
// changes only the abilities of the groups that were added or removed; the
// abilities of every other group stay exactly as they were. Callers refresh
// the channel cache.
func UpdateChannelGroup(channelID int, group string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		channel := &Channel{}
		if err := tx.First(channel, "id = ?", channelID).Error; err != nil {
			return err
		}
		// Abilities are keyed by the raw comma-separated entries, so compare
		// the raw entries rather than trimmed names.
		before := strings.Split(channel.Group, ",")
		after := strings.Split(group, ",")
		removed := make([]string, 0)
		for _, item := range before {
			if !slices.Contains(after, item) && !slices.Contains(removed, item) {
				removed = append(removed, item)
			}
		}
		added := make([]string, 0)
		for _, item := range after {
			if !slices.Contains(before, item) && !slices.Contains(added, item) {
				added = append(added, item)
			}
		}

		if err := tx.Model(&Channel{}).Where("id = ?", channelID).Update("group", group).Error; err != nil {
			return err
		}
		if len(removed) > 0 {
			if err := tx.Where(map[string]any{"channel_id": channelID, "group": removed}).Delete(&Ability{}).Error; err != nil {
				return err
			}
		}
		if len(added) == 0 {
			return nil
		}
		addedGroups := *channel
		addedGroups.Group = strings.Join(added, ",")
		return addedGroups.AddAbilities(tx)
	})
}

// UpdateChannelRouting writes a channel's priority, weight, and tag and copies
// them onto the channel's abilities, which carry the same fields for routing.
// A nil tag clears the tag. Callers refresh the channel cache.
func UpdateChannelRouting(channelID int, priority int64, weight uint, tag *string) error {
	values := map[string]any{"priority": priority, "weight": weight, "tag": tag}
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&Channel{}).Where("id = ?", channelID).Updates(values).Error; err != nil {
			return err
		}
		return tx.Model(&Ability{}).Where("channel_id = ?", channelID).Updates(values).Error
	})
}
