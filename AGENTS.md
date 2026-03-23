## Rules

### Strings
- Use double quotes for standard strings
- Use template literals (```) only when you need interpolation, multiline, or expression evaluation
- Avoid template literals for static strings

### Package Management
Use bun as the package manager for all dependency operations.

- Use `bun add <package>` and `bun remove <package>` for installing/removing dependencies
- Never manually edit `node_modules` or `bun.lock`
- Do not manually add, remove, or upgrade dependencies in `package.json`; use Bun commands instead
- Manual edits to `package.json` are allowed for scripts, metadata, or non-dependency fields
