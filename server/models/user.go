package models

import (
	"log"
	"os"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const (
	RoleAdmin = "admin"
	RoleUser  = "user"
)

type User struct {
	gorm.Model
	Username     string `gorm:"uniqueIndex;size:64" json:"username"`
	PasswordHash string `json:"-"`
	Role         string `json:"role"`
}

func (u *User) SetPassword(pw string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.PasswordHash = string(hash)
	return nil
}

func (u *User) CheckPassword(pw string) bool {
	return bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(pw)) == nil
}

// SeedAdmin creates a default admin if none exists.
func SeedAdmin(db *gorm.DB) {
	var count int64
	db.Model(&User{}).Where("role = ?", RoleAdmin).Count(&count)
	if count > 0 {
		return
	}
	adminUser := os.Getenv("ADMIN_USER")
	if adminUser == "" {
		adminUser = "admin"
	}
	adminPass := os.Getenv("ADMIN_PASS")
	if adminPass == "" {
		adminPass = "admin123"
	}

	u := &User{Username: adminUser, Role: RoleAdmin}
	if err := u.SetPassword(adminPass); err != nil {
		log.Printf("seed admin: generate pass: %v", err)
		return
	}
	if err := db.Create(u).Error; err != nil {
		log.Printf("seed admin: create: %v", err)
	} else {
		log.Printf("seeded admin user=%s password=%s", adminUser, adminPass)
	}
}
