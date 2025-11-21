package frontend

import (
	"embed"
	"io/fs"
)

//go:embed ui/*
var embeddedUI embed.FS

// Assets returns the embedded frontend file system rooted at ui/ so the router can serve
// static files directly from the compiled bundle. fs.Sub keeps file lookup paths stable.
func Assets() (fs.FS, error) {
	return fs.Sub(embeddedUI, "ui")
}
