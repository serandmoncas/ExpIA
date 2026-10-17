import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const TAXONOMY = 'categories:\n  - { id: llm-apps, label: Apps, color: "#3366ff" }\n'

export const NODE = `---
id: mcp
title: "MCP"
kind: protocol
category: [llm-apps]
released: 2024-11
audience: [technical]
level: intermediate
requires: []
related: []
status: emerging
summary: "Protocolo para conectar modelos con herramientas."
verified: false
added: 2026-10-17
---

## Para qué sirve

A

## Cómo se usa

status: esta línea es del cuerpo, no del frontmatter

## Para no técnicos

C
`

export const PERSON = `---
id: p
name: "P"
kind: person
languages: [en]
topics: [mcp]
audience: [technical]
level: intermediate
summary: "Explica MCP."
platforms:
  youtube: https://www.youtube.com/@p
highlights:
  - title: "Uno"
    url: https://example.com/1
    format: video
verified: false
added: 2026-10-17
---

## Por qué seguirle

Porque sí.
`

export const SOURCES = 'sources:\n  - { id: blog, name: Blog, kind: rss, url: "https://blog.example.com/feed.xml" }\n'

export function makeDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expia-radar-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), text)
  }
  return dir
}

export const BASE_FILES = {
  'taxonomy.yaml': TAXONOMY,
  'nodes/mcp.mdx': NODE,
  'nodes/rag.mdx': NODE.replace('id: mcp', 'id: rag').replace('title: "MCP"', 'title: "RAG"').replace('status: emerging', 'status: mainstream'),
  'people/p.mdx': PERSON,
  'sources.yaml': SOURCES,
}
