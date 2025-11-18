package models

import "gorm.io/gorm"

type File struct {
	gorm.Model
	OwnerID     uint   `json:"owner_id"`
	Owner       User   `gorm:"constraint:OnDelete:CASCADE" json:"owner"`
	Filename    string `json:"filename"`
	Path        string `json:"path"`
	Size        int64  `json:"size"`
	MimeType    string `json:"mime_type"`
	Description string `json:"description"`
	PublicLink  string `json:"public_link"` // optional share token path
}
