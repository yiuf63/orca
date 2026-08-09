// Why: nomnoml reads colors only from source directives, so a dark preview
// needs a prepended palette; directives the user writes later still win.
const DARK_NOMNOML_DIRECTIVES = `#fill: #3d3d3d; #4a4a4a; #3d3d3d; #4a4a4a
#background: transparent
#stroke: #d6d6d6
`

export function getNomnomlThemeSource(content: string, isDark: boolean): string {
  return isDark ? `${DARK_NOMNOML_DIRECTIVES}${content}` : content
}
