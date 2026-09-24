import { app } from 'electron'
import fs from 'fs'
import { join } from 'path'

export function resolvePowerShellScript(scriptName: string): string {
  const candidates = [
    process.resourcesPath ? join(process.resourcesPath, 'scripts', scriptName) : '',
    join(app.getAppPath(), 'src', 'main', 'autonomous', 'scripts', scriptName),
    typeof __dirname === 'string' ? join(__dirname, 'scripts', scriptName) : '',
    join(process.cwd(), 'src', 'main', 'autonomous', 'scripts', scriptName)
  ].filter(Boolean)

  const found = candidates.find((candidate) => fs.existsSync(candidate))
  if (!found) throw new Error(`Script PowerShell obrigatório não encontrado: ${scriptName}`)
  return found
}
