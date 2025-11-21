package frontend

import (
	"io/fs"
	"mime"
	"net/http"
	"path"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

// Register attaches a catch-all handler that serves the embedded SPA assets and
// falls back to index.html for client-side routes while keeping /api paths on
// the API surface. This keeps the final Go binary fully self contained.
func Register(r *gin.Engine, assets fs.FS) {
	r.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api") || c.Request.URL.Path == "/health" {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}

		requested := strings.TrimPrefix(c.Request.URL.Path, "/")
		requested = strings.TrimPrefix(path.Clean("/"+requested), "/")
		if requested == "" {
			requested = "index.html"
		}

		content, servedName, err := readFile(assets, requested)
		if err != nil {
			c.String(http.StatusInternalServerError, "frontend bundle missing")
			return
		}

		c.Data(http.StatusOK, detectContentType(servedName), content)
	})
}

// readFile tries the requested file, then a nested index, and finally the root
// index.html so SPA routes work when directly refreshed.
func readFile(assets fs.FS, requested string) ([]byte, string, error) {
	if data, err := fs.ReadFile(assets, requested); err == nil {
		return data, requested, nil
	}

	nestedIndex := filepath.ToSlash(filepath.Join(requested, "index.html"))
	if data, err := fs.ReadFile(assets, nestedIndex); err == nil {
		return data, nestedIndex, nil
	}

	data, err := fs.ReadFile(assets, "index.html")
	if err != nil {
		return nil, "", err
	}
	return data, "index.html", nil
}

// detectContentType prefers the file extension for static assets and defaults
// to HTML for SPA fallback responses.
func detectContentType(name string) string {
	if strings.HasSuffix(name, ".html") {
		return "text/html; charset=utf-8"
	}

	if ct := mime.TypeByExtension(filepath.Ext(name)); ct != "" {
		return ct
	}

	return "application/octet-stream"
}
