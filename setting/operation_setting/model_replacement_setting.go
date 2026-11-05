package operation_setting

import (
	"math"
	"regexp"
	"slices"
	"strings"
	"sync/atomic"

	"github.com/QuantumNous/new-api/common"
)

// ModelReplacementSettingOptionKey stores the whole model replacement
// detection configuration as one JSON document, so a save replaces every
// field at once and a running detection reads one consistent snapshot.
const ModelReplacementSettingOptionKey = "ModelReplacementDetectionSetting"

const (
	ModelReplacementMatchExact    = "exact"
	ModelReplacementMatchContains = "contains"
	ModelReplacementMatchRegex    = "regex"

	DefaultModelReplacementIntervalMinutes = 10
	DefaultModelReplacementRounds          = 3
	DefaultModelReplacementConcurrency     = 3
	DefaultModelReplacementTimeoutSeconds  = 60
	DefaultModelReplacementRetryTimes      = 2

	MaxModelReplacementIntervalMinutes = 7 * 24 * 60
	MaxModelReplacementRounds          = 50
	MaxModelReplacementTimeoutSeconds  = 600
	MaxModelReplacementRetryTimes      = 10
	MaxModelReplacementModels          = 200
	MaxModelReplacementTextLength      = 4000
	maxModelReplacementGroupLength     = 64

	// MaxModelReplacementActions bounds each action list.
	MaxModelReplacementActions = 20
	// ModelReplacementRoutingLimit bounds action amounts and the priority and
	// weight values actions produce, so repeated runs cannot overflow them.
	ModelReplacementRoutingLimit = math.MaxInt32
	maxModelReplacementTagLength = 64
)

// Action types run on a channel after a detection run, in configured order.
const (
	ModelReplacementActionAddGroup         = "add_group"
	ModelReplacementActionRemoveGroup      = "remove_group"
	ModelReplacementActionIncreasePriority = "increase_priority"
	ModelReplacementActionDecreasePriority = "decrease_priority"
	ModelReplacementActionSetPriority      = "set_priority"
	ModelReplacementActionIncreaseWeight   = "increase_weight"
	ModelReplacementActionDecreaseWeight   = "decrease_weight"
	ModelReplacementActionSetWeight        = "set_weight"
	ModelReplacementActionAutoDisable      = "auto_disable"
	ModelReplacementActionManualDisable    = "manual_disable"
	ModelReplacementActionSetTag           = "set_tag"
	ModelReplacementActionRemoveTag        = "remove_tag"
)

// ModelReplacementAction is one configured step. Value carries the group or
// tag; Amount carries the priority or weight number.
type ModelReplacementAction struct {
	Type   string `json:"type"`
	Value  string `json:"value"`
	Amount int64  `json:"amount"`
}

type ModelReplacementModelSetting struct {
	Model          string `json:"model"`
	Question       string `json:"question"`
	ExpectedAnswer string `json:"expected_answer"`
	MatchMode      string `json:"match_mode"`
	RetryTimes     int    `json:"retry_times"`
	// ExcludedChannelIDs lists the channels an administrator unchecked. Storing
	// exclusions instead of inclusions keeps channels added later in scope.
	ExcludedChannelIDs []int `json:"excluded_channel_ids"`
}

type ModelReplacementSetting struct {
	Enabled         bool    `json:"enabled"`
	IntervalMinutes int     `json:"interval_minutes"`
	Rounds          int     `json:"rounds"`
	Concurrency     int     `json:"concurrency"`
	TimeoutSeconds  int     `json:"timeout_seconds"`
	Threshold       float64 `json:"threshold"`
	// PassActions run on a channel whose detected models all passed;
	// FailActions run on a channel with a replaced model or with requests
	// that still failed after their retries.
	PassActions []ModelReplacementAction       `json:"pass_actions"`
	FailActions []ModelReplacementAction       `json:"fail_actions"`
	Models      []ModelReplacementModelSetting `json:"models"`
}

var modelReplacementSetting atomic.Pointer[ModelReplacementSetting]

func init() {
	defaults := DefaultModelReplacementSetting()
	modelReplacementSetting.Store(&defaults)
}

func DefaultModelReplacementSetting() ModelReplacementSetting {
	return ModelReplacementSetting{
		IntervalMinutes: DefaultModelReplacementIntervalMinutes,
		Rounds:          DefaultModelReplacementRounds,
		Concurrency:     DefaultModelReplacementConcurrency,
		TimeoutSeconds:  DefaultModelReplacementTimeoutSeconds,
		PassActions:     []ModelReplacementAction{},
		FailActions:     []ModelReplacementAction{},
		Models:          []ModelReplacementModelSetting{},
	}
}

// GetModelReplacementSetting returns the current snapshot. Callers must treat
// the slices in it as read-only; a reload swaps in a new snapshot instead of
// mutating this one.
func GetModelReplacementSetting() ModelReplacementSetting {
	return *modelReplacementSetting.Load()
}

// ModelReplacementSettingJSON is the stored form of the current snapshot.
func ModelReplacementSettingJSON() string {
	data, err := common.Marshal(modelReplacementSetting.Load())
	if err != nil {
		return "{}"
	}
	return string(data)
}

// LoadModelReplacementSetting applies a stored value. An invalid value keeps
// the previous snapshot so a bad row cannot silently reset the configuration.
func LoadModelReplacementSetting(value string) {
	parsed, err := ParseModelReplacementSetting(value)
	if err != nil {
		common.SysError(common.LogText("failed to load model replacement detection settings: %s", err.Error()))
		return
	}
	modelReplacementSetting.Store(&parsed)
}

// ParseModelReplacementSetting decodes, normalizes, and validates a stored or
// submitted configuration. Missing top-level fields take their defaults.
func ParseModelReplacementSetting(value string) (ModelReplacementSetting, error) {
	setting := DefaultModelReplacementSetting()
	if strings.TrimSpace(value) != "" {
		if err := common.UnmarshalJsonStr(value, &setting); err != nil {
			return ModelReplacementSetting{}, common.NewMessage("Invalid model replacement detection settings")
		}
	}
	return setting, setting.normalize()
}

func (setting *ModelReplacementSetting) normalize() error {
	if setting.IntervalMinutes < 1 || setting.IntervalMinutes > MaxModelReplacementIntervalMinutes {
		return common.NewMessage("Detection interval must be between 1 and {{max}} minutes", map[string]any{"max": MaxModelReplacementIntervalMinutes})
	}
	if setting.Rounds < 1 || setting.Rounds > MaxModelReplacementRounds {
		return common.NewMessage("Test rounds must be between 1 and {{max}}", map[string]any{"max": MaxModelReplacementRounds})
	}
	if setting.Concurrency < 1 || setting.Concurrency > MaxChannelTestConcurrency {
		return common.NewMessage("Maximum concurrency must be between 1 and {{max}}", map[string]any{"max": MaxChannelTestConcurrency})
	}
	if setting.TimeoutSeconds < 1 || setting.TimeoutSeconds > MaxModelReplacementTimeoutSeconds {
		return common.NewMessage("Timeout must be between 1 and {{max}} seconds", map[string]any{"max": MaxModelReplacementTimeoutSeconds})
	}
	if setting.Threshold < 0 || setting.Threshold > 100 {
		return common.NewMessage("Mismatch threshold must be between 0 and 100")
	}

	for _, actions := range []*[]ModelReplacementAction{&setting.PassActions, &setting.FailActions} {
		if *actions == nil {
			*actions = []ModelReplacementAction{}
		}
		if len(*actions) > MaxModelReplacementActions {
			return common.NewMessage("At most {{max}} actions can be configured for each result", map[string]any{"max": MaxModelReplacementActions})
		}
		for i := range *actions {
			if err := (*actions)[i].normalize(); err != nil {
				return err
			}
		}
	}

	if setting.Models == nil {
		setting.Models = []ModelReplacementModelSetting{}
	}
	if len(setting.Models) > MaxModelReplacementModels {
		return common.NewMessage("At most {{max}} models can be detected", map[string]any{"max": MaxModelReplacementModels})
	}
	seen := make(map[string]struct{}, len(setting.Models))
	for i := range setting.Models {
		item := &setting.Models[i]
		item.Model = strings.TrimSpace(item.Model)
		item.Question = strings.TrimSpace(item.Question)
		item.ExpectedAnswer = strings.TrimSpace(item.ExpectedAnswer)
		if item.Model == "" {
			return common.NewMessage("Model name is required")
		}
		if _, ok := seen[item.Model]; ok {
			return common.NewMessage("Model {{model}} is configured more than once", map[string]any{"model": item.Model})
		}
		seen[item.Model] = struct{}{}
		if item.Question == "" || item.ExpectedAnswer == "" {
			return common.NewMessage("Enter the test question and expected answer for {{model}}", map[string]any{"model": item.Model})
		}
		if len(item.Question) > MaxModelReplacementTextLength || len(item.ExpectedAnswer) > MaxModelReplacementTextLength {
			return common.NewMessage("The test question and expected answer for {{model}} must not exceed {{max}} characters", map[string]any{"model": item.Model, "max": MaxModelReplacementTextLength})
		}
		switch item.MatchMode {
		case ModelReplacementMatchExact, ModelReplacementMatchContains:
		case ModelReplacementMatchRegex:
			if _, err := regexp.Compile(item.ExpectedAnswer); err != nil {
				return common.NewMessage("The expected answer for {{model}} is not a valid regular expression", map[string]any{"model": item.Model})
			}
		case "":
			item.MatchMode = ModelReplacementMatchExact
		default:
			return common.NewMessage("Unknown answer match mode for {{model}}", map[string]any{"model": item.Model})
		}
		if item.RetryTimes < 0 || item.RetryTimes > MaxModelReplacementRetryTimes {
			return common.NewMessage("Retry times for {{model}} must be between 0 and {{max}}", map[string]any{"model": item.Model, "max": MaxModelReplacementRetryTimes})
		}
		item.ExcludedChannelIDs = slices.Compact(slices.Sorted(slices.Values(item.ExcludedChannelIDs)))
		if item.ExcludedChannelIDs == nil {
			item.ExcludedChannelIDs = []int{}
		}
	}
	return nil
}

// normalize trims the action parameter, clears the field the type does not
// use, and validates the one it does.
func (action *ModelReplacementAction) normalize() error {
	action.Value = strings.TrimSpace(action.Value)
	switch action.Type {
	case ModelReplacementActionAddGroup, ModelReplacementActionRemoveGroup:
		action.Amount = 0
		if action.Value == "" || strings.Contains(action.Value, ",") || len(action.Value) > maxModelReplacementGroupLength {
			return common.NewMessage("Group names cannot be empty, contain commas, or exceed 64 characters")
		}
	case ModelReplacementActionSetTag, ModelReplacementActionRemoveTag:
		action.Amount = 0
		if (action.Type == ModelReplacementActionSetTag && action.Value == "") || len(action.Value) > maxModelReplacementTagLength {
			return common.NewMessage("Tags cannot be empty or exceed 64 characters")
		}
	case ModelReplacementActionIncreasePriority, ModelReplacementActionDecreasePriority,
		ModelReplacementActionIncreaseWeight, ModelReplacementActionDecreaseWeight:
		action.Value = ""
		if action.Amount < 1 || action.Amount > ModelReplacementRoutingLimit {
			return common.NewMessage("Amounts must be between 1 and {{max}}", map[string]any{"max": ModelReplacementRoutingLimit})
		}
	case ModelReplacementActionSetPriority:
		action.Value = ""
		if action.Amount < -ModelReplacementRoutingLimit || action.Amount > ModelReplacementRoutingLimit {
			return common.NewMessage("Priority must be between {{min}} and {{max}}", map[string]any{"min": -ModelReplacementRoutingLimit, "max": ModelReplacementRoutingLimit})
		}
	case ModelReplacementActionSetWeight:
		action.Value = ""
		if action.Amount < 0 || action.Amount > ModelReplacementRoutingLimit {
			return common.NewMessage("Weight must be between 0 and {{max}}", map[string]any{"max": ModelReplacementRoutingLimit})
		}
	case ModelReplacementActionAutoDisable, ModelReplacementActionManualDisable:
		action.Value = ""
		action.Amount = 0
	default:
		return common.NewMessage("Unknown detection action")
	}
	return nil
}

// AnswerMatches reports whether a model reply satisfies the configured
// expected answer. Surrounding whitespace in the reply is ignored; exact and
// contains comparisons are case-sensitive.
func (item ModelReplacementModelSetting) AnswerMatches(answer string) bool {
	answer = strings.TrimSpace(answer)
	switch item.MatchMode {
	case ModelReplacementMatchContains:
		return strings.Contains(answer, item.ExpectedAnswer)
	case ModelReplacementMatchRegex:
		pattern, err := regexp.Compile(item.ExpectedAnswer)
		if err != nil {
			return false
		}
		return pattern.MatchString(answer)
	default:
		return answer == item.ExpectedAnswer
	}
}
