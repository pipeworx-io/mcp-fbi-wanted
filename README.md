# mcp-fbi-wanted

FBI Wanted MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search_wanted` | Search the FBI's Wanted persons database — fugitives, Most Wanted, cyber's-most-wanted, terrorists, white-collar suspects, kidnappings/missing persons, and law-enforcement-assistance cases. Returns compact records with reward, warning, and image. Keyless, official FBI data. |
| `get_wanted` | Get the full FBI Wanted profile for one person by uid — physical description, aliases, occupations, caution/remarks/details (plain text), reward, field offices, and images. Keyless, official FBI data. |
| `most_wanted` | The FBI's Ten Most Wanted Fugitives. Returns the current top-ten list with reward, warning, and image for each. Keyless, official FBI data. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "fbi-wanted": {
      "url": "https://gateway.pipeworx.io/fbi-wanted/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Fbi Wanted data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
