package models

import (
	"time"

	"gorm.io/gorm"
)

// Share 表示一个受控的文件分享链接，支持登录约束、限定用户、次数与有效期。
type Share struct {
	gorm.Model
	Token        string     `gorm:"uniqueIndex;size:191" json:"token"`
	FileID       uint       `json:"file_id"`
	File         File       `gorm:"constraint:OnDelete:CASCADE" json:"file"`
	CreatorID    uint       `json:"creator_id"`
	Creator      User       `gorm:"constraint:OnDelete:SET NULL" json:"creator"`
	RequireLogin bool       `json:"require_login"`
	AllowUserID  *uint      `json:"allow_user_id"`
	AllowUser    *User      `gorm:"constraint:OnDelete:SET NULL" json:"allow_user"`
	MaxViews     *uint      `json:"max_views"`
	ViewCount    uint       `json:"view_count"`
	ExpiresAt    *time.Time `json:"expires_at"`
}

// Expired 判断分享是否已过期。
func (s *Share) Expired(now time.Time) bool {
	if s.ExpiresAt == nil {
		return false
	}
	return now.After(*s.ExpiresAt)
}
