package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port        string
	DBPath      string
	JWTSecret   string
	UploadDir   string
	AllowOrigin string
}

func Load() *Config {
	return &Config{
		Port:        getenv("PORT", "8080"),
		DBPath:      getenv("DB_PATH", "data/app.db"),
		JWTSecret:   getenv("JWT_SECRET", "replace-me"),
		UploadDir:   getenv("UPLOAD_DIR", "uploads"),
		AllowOrigin: getenv("ALLOW_ORIGIN", "*"),
	}
}

func (c *Config) Addr() string {
	return fmt.Sprintf(":%s", c.Port)
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
