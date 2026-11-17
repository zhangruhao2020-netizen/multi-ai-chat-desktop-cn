import { useEffect, useRef, useState } from 'react';
import { AI_PROVIDERS } from '../../shared/constants';
import type { AIProvider } from '../../shared/types';
import type { Locale } from '../i18n/resolve';
import { formatI18n, t } from '../i18n/t';
import { isInactiveStandbyProvider } from '../workflow/graph/preflight';
import { Button } from './Button';
import { ModalDialog } from './ModalDialog';
import type { PreflightDialogModel } from './preflightModel';

export function PreflightDialog({
  model,
  onOpenLogin,
  onOpenSettings,
  onClose,
  onSwitchMode,
  locale = 'en',
  hidden = false,
  activeProviders,
}: {
  model: PreflightDialogModel;
  onOpenLogin: (provider: AIProvider) => void | Promise<void>;
  onOpenSettings?: () => void;
  onClose: () => void;
  onSwitchMode: () => void;
  locale?: Locale;
  hidden?: boolean;
  activeProviders?: readonly AIProvider[];
}) {
  const [loginError, setLoginError] = useState<AIProvider>();
  const loginInFlight = useRef(false);
  const loginGeneration = useRef(0);
  useEffect(() => () => { loginGeneration.current += 1; }, []);

  const dismiss = (action: () => void) => {
    loginGeneration.current += 1;
    action();
  };
  const openSettings = () => {
    loginGeneration.current += 1;
    onOpenSettings?.();
  };
  const openLogin = async (provider: AIProvider) => {
    const item = model.unavailable.find((entry) => entry.provider === provider);
    if (loginInFlight.current || !item || isInactiveStandbyProvider(item.provider, activeProviders)) return;
    loginInFlight.current = true;
    const generation = ++loginGeneration.current;
    setLoginError(undefined);
    try {
      await onOpenLogin(provider);
      if (generation === loginGeneration.current) onClose();
    } catch {
      if (generation === loginGeneration.current) setLoginError(provider);
    } finally {
      loginInFlight.current = false;
    }
  };

  const loginErrorItem = loginError
    ? model.unavailable.find((item) => item.provider === loginError)
    : undefined;
  const loginErrorIsStandby = loginErrorItem
    ? isInactiveStandbyProvider(loginErrorItem.provider, activeProviders)
    : false;

  // Keep request/error state while App temporarily clears the native overlay guard.
  if (hidden) return null;
  return (
    <ModalDialog
      titleId="preflight-title"
      onEscape={() => dismiss(onClose)}
      onBackdrop={() => dismiss(onClose)}
      panelClassName="w-full max-w-md rounded-lg border border-zinc-300 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-950"
    >
        <h2 id="preflight-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{model.title}</h2>
        <div className="mt-3 space-y-2 text-sm">
          {model.unavailable.map((item) => {
            const standby = isInactiveStandbyProvider(item.provider, activeProviders);
            const reason = standby ? t('settings.providerStandby', locale) : item.reason;
            return (
              <div key={item.provider} className="ui-panel flex items-center justify-between gap-3 p-2">
                <div className="min-w-0">
                  <span style={{ color: AI_PROVIDERS[item.provider].color }}>{item.label}</span>
                  <span className="text-zinc-600 dark:text-zinc-400"> - {reason}</span>
                </div>
                {standby ? (
                  onOpenSettings ? (
                    <Button variant="primary" size="sm" className="shrink-0" onClick={openSettings}>
                      {t('settings.title', locale)}
                    </Button>
                  ) : null
                ) : (
                  <Button variant="primary" size="sm" className="shrink-0" onClick={() => void openLogin(item.provider)}>
                    {t('preflight.openLogin', locale)}
                  </Button>
                )}
              </div>
            );
          })}
          {model.aliased.map((item) => (
            <div key={item.provider} className="ui-panel p-2">
              <span style={{ color: AI_PROVIDERS[item.provider].color }}>{item.label}</span>
              <span className="text-zinc-600 dark:text-zinc-400"> - {item.reason}</span>
            </div>
          ))}
          {model.tooFewProviders ? (
            <div className="ui-panel flex items-center justify-between gap-3 p-2">
              <span className="min-w-0 text-zinc-600 dark:text-zinc-400">{model.tooFewProviders}</span>
              {onOpenSettings ? (
                <Button variant="primary" size="sm" className="shrink-0" onClick={openSettings}>
                  {t('settings.title', locale)}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {loginErrorItem && !loginErrorIsStandby ? (
          <div role="alert" className="ui-banner-red mt-3 px-3 py-2 text-xs">
            {formatI18n(t('provider.openFailed', locale), { provider: AI_PROVIDERS[loginErrorItem.provider].name })}
            <Button variant="danger" size="sm" className="ml-3 font-medium" onClick={() => void openLogin(loginErrorItem.provider)}>
              {t('provider.retry', locale)}
            </Button>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => dismiss(onClose)}>
            {t('preflight.close', locale)}
          </Button>
          <Button variant="subtle" onClick={() => dismiss(onSwitchMode)}>
            {t('preflight.switchMode', locale)}
          </Button>
        </div>
    </ModalDialog>
  );
}
