package models

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

// APIScope 用于声明 API Key 允许访问的能力，便于后续扩展更多接口时复用校验逻辑。
type APIScope string

const (
	// ScopeFilesUpload 允许匿名通过 API Key 调用文件上传接口。
	ScopeFilesUpload APIScope = "files:upload"
)

// APIKey 保存管理型密钥的元数据，仅存储哈希值以避免明文泄露；上传关联到指定用户，便于审计和资源归属。
type APIKey struct {
	gorm.Model
	Name        string     `json:"name"`
	HashedKey   string     `gorm:"uniqueIndex;size:191" json:"-"`
	Scopes      string     `json:"scopes"` // 逗号分隔的 scope 列表，简单可读且便于扩展
	ExpiresAt   *time.Time `json:"expires_at"`
	Revoked     bool       `json:"revoked"`
	BoundUserID uint       `json:"bound_user_id"`
	BoundUser   User       `gorm:"constraint:OnDelete:SET NULL" json:"bound_user"`
	CreatedByID uint       `json:"created_by_id"`
	CreatedBy   User       `gorm:"constraint:OnDelete:SET NULL" json:"created_by"`
	LastUsedAt  *time.Time `json:"last_used_at"`
}

// GenerateRawAPIKey 生成一次性返回给客户端的明文 Key，前缀便于识别来源；返回值仅用于本次调用。
func GenerateRawAPIKey() (string, error) {
	const prefix = "ch_"
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("rand api key: %w", err)
	}
	return prefix + hex.EncodeToString(buf), nil
}

// HashAPIKey 使用 SHA256 对明文 Key 做不可逆哈希，数据库仅保存哈希值。
func HashAPIKey(raw string) string {
	digest := sha256.Sum256([]byte(strings.TrimSpace(raw)))
	return hex.EncodeToString(digest[:])
}

// MaskedKey 返回用于列表展示的脱敏片段，避免在界面上暴露完整密钥。
func MaskedKey(raw string) string {
	if raw == "" {
		return ""
	}
	if len(raw) <= 8 {
		return "****"
	}
	return raw[:4] + "..." + raw[len(raw)-4:]
}

// HasScope 判断当前 key 是否具备指定能力，支持通配符 *。
func (k *APIKey) HasScope(scope APIScope) bool {
	if scope == "" {
		return true
	}
	scopes := k.ScopeList()
	for _, s := range scopes {
		if s == "*" || APIScope(strings.TrimSpace(s)) == scope {
			return true
		}
	}
	return false
}

// ScopeList 将逗号分隔的 scope 字段转成字符串切片，空值返回空切片。
func (k *APIKey) ScopeList() []string {
	if k.Scopes == "" {
		return []string{}
	}
	parts := strings.Split(k.Scopes, ",")
	res := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			res = append(res, trimmed)
		}
	}
	return res
}
