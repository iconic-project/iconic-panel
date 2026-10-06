// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import betterTailwindcss from 'eslint-plugin-better-tailwindcss'
import { getDefaultAttributes } from 'eslint-plugin-better-tailwindcss/api/defaults'
import vocabulary from './eslint/vocabulary.mjs'

export default withNuxt(
  betterTailwindcss.configs['correctness-error'],
  {
    files: ['app/**/*.{ts,vue,js,mjs}'],
    plugins: { vocabulary },
    rules: {
      'vocabulary/no-retired-vocabulary': 'error'
    }
  },
  {
    settings: {
      'better-tailwindcss': {
        entryPoint: '../iconic-ui/app/assets/css/main.css',
        attributes: [
          ...getDefaultAttributes(),
          ['^v-bind:ui$', [{ match: 'objectValues' }]]
        ]
      }
    },
    rules: {
      'better-tailwindcss/no-unknown-classes': ['error', {
        ignore: [
          '^(app|tl-line|tl-arrow|crm-task-head|nb-suggest|nb-suggest-item|nb-extra|nbx|nb-addrow|nb-price|pline-err|req-notice|req-ref|via|slat|ok|req-expired|hold-expires|wl-free|wl-notified|brand|brand-mark--dark|brand-mark--light|navsec|nav|nav-badge|sideprow|tophead|tophead--rms|tophead--crm|drbar-slot|who|who-select|who-email|mono|sysbadge|sys-rms|placeholder-copy|section-switch|fchip|fchips|on|auth-layout|auth-theme|auth-column|auth-pane|auth-stage|auth-stage-top|auth-stage-kicker|auth-stage-copy|auth-stage-title|auth-stage-body|auth-facade|auth-window|auth-canopy|auth-key|auth-key-chip|auth-key-meta|auth-key-kicker|auth-key-name|auth-desk|auth-form|auth-actions|auth-hint|auth-link|notice|warnbox|alert-bell|alert-bell-icon|list|list-toolbar|list-filters|list-search|list-pager|list-actions|user-cell|user-email|row-actions|modal-form|modal-actions|field-hint|history-drawer|bid|history-note|history-zone|history-load|tl2|tli|tlt|tlw|dr-empty|matrix-scroll|matrix-sticky|matrix-role|matrix-role-head|matrix-users|matrix-group|matrix-cell--dirty|matrix-cell-btn|matrix-warn|matrix-bar|matrix-bar-actions|matrix-tip|esbar|acts|rreason|bad|rcell|rin|yoy|rhelp|mini|rflag|rwarn|rdiff|bands|rtab|nw|esbar-state--ok|esbar-state--warn|esbar-state--ro|esbar-warn|config-change-to|config-change-from|config-change-list|config-confirm-note|config-history-scroll|rates-scroll|rates-round-label|rates-add|rates-year-help|note|lnk|price-check-dimmed|price-check-up|price-check-down|price-check-same|price-check-none|price-stay|price-stay-fields|price-stay-ages|season-strip|season-month|season-month-note|is-gap|is-partial|legacy-block|legacy-summary|tax-editor|tax-row|sets-editor|set-block|engine-notice|setgrid|field|cols2|cnt|chkline|chkgrid|prevbox|prevl|roval|engine-note|engine-preview-body|engine-locale|rules-notice|krow|rules-chips|rule-code|rule-pill|rule-used|rule-source|rule-source-empty|rules-kpi-flag|rules-kpi-ok|rules-scroll|itin-notice|ebtool|pill|p-conf|p-pend|p-wait|p-hold|p-canc|p-comp|p-req|p-full|p-over|itgrid|itc|noimg|bd|im|itmeta|cmp|itin-complete|sec|edrow|r2|xbtn|sublabel|edfs|transbtns|itin-code|itin-photo|itin-warn|itin-header|panel|drbar|drl|drb|drp|drio|drarr|drf|drt|drx|drc|active|invbar|invtxt|tsel|cabchips|cabchip|cc-sold|cc-held|cc-block|cc-free|pdrow|dep-notice|dep-kpi-warn|dep-kpi-full|dep-row|dep-dates|dep-sub|dep-itin-warn|dep-rates-missing|dep-festive|dep-note-badge|dep-header|dep-warn|dep-inventory-note|dep-toolbar|dep-table-wrap|dep-create-as|legend|sw|sw-av|sw-hold|sw-conf|sw-full|sw-dep|sw-req|sw-charter|sw-block|tl|rowh|xmas|cell|c-av|c-none|c-hold|c-conf|c-dep|c-full|c-block|c-charter|c-req|yachthdr|cal-notice|dr-none|layoutwrap|deck|deck-hdr|no-sail|no-sail-label|bow|dg|cab|cn|st|owner|s-conf|s-dep|s-hold|s-block|yl-select|blk-new|blk-released|blk-scope|blk-meta|blk-radios|blk-dep-list|blk-dep-free|blk-cabins|sg|sg-d2c|sg-b2b|sg-ch|dtabs|dtab|kv|gmeta|pline|tot|bk-ref|bk-sub|bk-toolbar|bk-search|bk-mine|bk-table-wrap|bk-filters|bk-date|bk-row|bk-balance|bk-balance--zero|bk-terminal|bk-bid-extra|move-diff-up|move-diff-down|move-diff-same|mini-t|pay-pledged|pay-tick|pay-amt-refund|pay-form|pay-links|pay-link-row|pay-link-url|pay-kpi-coral|pay-recon-note|gcard|gcard-inc|gcard-edit|gtop|gf-head|gf-guard|gf-hint|guests-ok|guests-miss|guests-muted|guests-line|guests-footnote|extras-intro|extras-sub|extras-fees|extras-due|charges-rule|anccat-wrap|anccat|anccat-code|anccat-name|anccat-price|contacts-notice|ct-source|ct-advisor|natbar-cell|natbar|doc-blocked|doc-error|doc-trigger|doc-versions|billing-muted|billing-form|pay-receipt|doc-modal|docbox|docbar|docbar-acts|doc-frame|doc-chip-stack|of-notice|of-code|of-scope|of-placement|of-hits|badge-offer|promo-off|of-promo-note|field-label|off|crm-banner|ro|new|crm-held|crm-tl|crm-ev|crm-ev-title|crm-merge-modal|crm-merge-grid|crm-merge-col|crm-notice|crm-dup-reasons|crm-filters|crm-channel|crm-hint|crm-event|crm-side|crm-code|crm-bus-note|crm-grid2|crm-job-failed|sys-crm|sys-eng|sys-ext|hi|mid|t|taskrow|due|ttl|ctx|crm-deal|card-val|slabadge|rmsref|none|crm-deal-actions|crm-inline|crm-kpi-alert|crm-kpi-warn|crm-check|pipe|col|sla|money|cards|card|lock|nm|val|move|gx-dates|gx-warn|gx-brief|gx-empty|gx-nps-kpis|gx-coral|dash-def|dash-occ|journey|jh|jh-title|jh-side|goal|contract|trigger|jbranch|jsteps|jstep|sn|sl|sa|sc|joff|jfoot|journey-version|journey-preview|seg-toolbar|seg-open|seg-head|seg-actions|seg-condition|seg-age|segs|segc|exception|dimrow|dim|rule|feeds|autosec|auto|auto-note|auto-links|unbuilt|toggle|sub|k|n|nav-scroll|inbox-unmatched|inbox-link|inbox-page|inbox-notice|inbox-filters|inboxgrid|convcol|convlist|conv-empty|conv|unread|cp|ctags|chtag|em|thread|thhead|tn|th-meta|th-actions|btn|o|booking-note|msgs|msg|mt|composer|comprow|send-via|chbtn|crow2|walock|refunds-notice|panel-locale|panel-locale-btn|conflicts|emap-scroll|emap-step|emap-copy|emap-kpi-ok|emap-kpi-gap|night-page|night-toolbar|night-property|night-scroll|night-row|night-head|night-label|night-cell|night-meta|night-type|night-bar|night-legend|night-editor|night-editor-grid|stack|field-error|check-row)$'
        ]
      }]
    }
  }
)
