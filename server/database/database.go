package database

import (
	"fmt"
	"os"

	"content-hub/server/config"
	"content-hub/server/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func Connect(cfg *config.Config) (*gorm.DB, error) {
	if err := os.MkdirAll(dirOf(cfg.DBPath), 0o755); err != nil {
		return nil, fmt.Errorf("mkdir db dir: %w", err)
	}

	db, err := gorm.Open(sqlite.Open(cfg.DBPath), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	if err := db.AutoMigrate(&models.User{}, &models.File{}, &models.Share{}); err != nil {
		return nil, fmt.Errorf("auto migrate: %w", err)
	}

	models.SeedAdmin(db)

	return db, nil
}

func dirOf(path string) string {
	if idx := len(path) - 1; idx >= 0 {
		for i := idx; i >= 0; i-- {
			if path[i] == '/' {
				return path[:i]
			}
		}
	}
	return "."
}
