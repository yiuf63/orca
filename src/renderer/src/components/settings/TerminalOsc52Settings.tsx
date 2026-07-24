import type { GlobalSettings } from '../../../../shared/types'
import { translate } from '@/i18n/i18n'
import {
  OSC52_CLIPBOARD_READ_SETTING_ID,
  OSC52_CLIPBOARD_SETTING_ID
} from '../terminal-pane/osc52-clipboard-setting-anchor'
import { SearchableSetting } from './SearchableSetting'
import { SettingsSwitchRow } from './SettingsFormControls'

type TerminalOsc52SettingsProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

const OSC52_SEARCH_KEYWORDS = [
  'osc 52',
  'osc52',
  'clipboard',
  'tmux',
  'neovim',
  'nvim',
  'fzf',
  'grok',
  'ssh',
  'remote'
]

export function TerminalOsc52Settings({
  settings,
  updateSettings
}: TerminalOsc52SettingsProps): React.JSX.Element {
  return (
    <>
      <SearchableSetting
        id={OSC52_CLIPBOARD_SETTING_ID}
        title={translate(
          'auto.components.settings.TerminalPane.3338dcf8c1',
          'Allow TUI Clipboard Writes (OSC 52)'
        )}
        description={translate(
          'auto.components.settings.TerminalPane.69c64a479c',
          'Let Grok, tmux, Neovim, and fzf copy to the system clipboard over the PTY (including over SSH).'
        )}
        keywords={[...OSC52_SEARCH_KEYWORDS, 'copy', 'paste']}
      >
        <SettingsSwitchRow
          label={translate(
            'auto.components.settings.TerminalPane.3338dcf8c1',
            'Allow TUI Clipboard Writes (OSC 52)'
          )}
          description={translate(
            'auto.components.settings.TerminalPane.6e6480a7df',
            'Let programs in the terminal (Grok, tmux, Neovim, fzf, SSH) copy to your system clipboard.'
          )}
          checked={settings.terminalAllowOsc52Clipboard}
          onChange={() =>
            updateSettings({
              terminalAllowOsc52Clipboard: !settings.terminalAllowOsc52Clipboard
            })
          }
        />
      </SearchableSetting>

      <SearchableSetting
        id={OSC52_CLIPBOARD_READ_SETTING_ID}
        title={translate(
          'auto.components.settings.TerminalPane.b81f06a9c2',
          'Allow TUI Clipboard Reads (OSC 52)'
        )}
        description={translate(
          'auto.components.settings.TerminalPane.41e753c28d',
          'Let programs in the active terminal read the system clipboard while Orca is focused, including over SSH.'
        )}
        keywords={[...OSC52_SEARCH_KEYWORDS, 'read', 'security', 'sensitive']}
      >
        <SettingsSwitchRow
          label={translate(
            'auto.components.settings.TerminalPane.b81f06a9c2',
            'Allow TUI Clipboard Reads (OSC 52)'
          )}
          description={translate(
            'auto.components.settings.TerminalPane.8bc94512ae',
            'Allows the focused active terminal to read clipboard text. Enable only for terminals and SSH hosts you trust.'
          )}
          checked={settings.terminalAllowOsc52ClipboardRead === true}
          onChange={() =>
            updateSettings({
              terminalAllowOsc52ClipboardRead: settings.terminalAllowOsc52ClipboardRead !== true
            })
          }
        />
      </SearchableSetting>
    </>
  )
}
