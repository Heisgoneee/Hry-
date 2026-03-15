// Global profanity censorship toggle
(function () {
    const BAD_WORDS = [
        // CZ
        'kurva', 'kurvy', 'píča', 'píco', 'kokot', 'debil', 'čurák', 
        'kretén', 'hovno', 'prdel', 'jebat', 'zkurvysyn', 'mrcha', 'buzna',
        'cigan', 'cigán', 'cikán', 'negr',
        // EN
        'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bitch', 
        'asshole', 'cunt', 'dick', 'cock', 'pussy', 'slut', 'whore', 
        'nigger', 'nigga', 'faggot', 'bastard', 'retard'
    ];

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function censorText(text) {
        if (!text) return text;
        let result = text;
        
        // Seřadíme slova od nejdelšího po nejkratší, aby se delší fráze nahradily jako první
        const sortedWords = BAD_WORDS.slice().sort((a, b) => b.length - a.length);

        sortedWords.forEach(word => {
            // Odstranili jsme \b, aby to chytalo i slepená slova jako "NegrCigan"
            const pattern = new RegExp(escapeRegExp(word), 'gi');
            
            result = result.replace(pattern, (match) => {
                if (match.length <= 2) {
                    return '*'.repeat(match.length);
                }
                // Ponechá první a poslední písmeno, vnitřek nahradí hvězdičkami (např. n**r)
                return match[0] + '*'.repeat(match.length - 2) + match[match.length - 1];
            });
        });
        return result;
    }

    function ensureSettingsStyle() {
        if (document.getElementById('global-settings-style')) return;
        const style = document.createElement('style');
        style.id = 'global-settings-style';
        style.textContent = `
            #settings-button {
                position: fixed;
                right: 16px;
                bottom: 16px;
                padding: 10px 14px;
                border-radius: 999px;
                border: 1px solid rgba(255,255,255,0.2);
                background: rgba(0,0,0,0.65);
                color: #fff;
                cursor: pointer;
                font: 700 14px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                z-index: 10000;
                backdrop-filter: blur(8px);
            }

            #settings-button:hover {
                border-color: rgba(255,255,255,0.35);
            }

            #settings-modal {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.65);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 10001;
                padding: 16px;
                box-sizing: border-box;
            }

            #settings-modal .settings-card {
                width: min(360px, 100%);
                background: rgba(15,15,15,0.92);
                color: #fff;
                border: 1px solid rgba(255,255,255,0.18);
                border-radius: 14px;
                padding: 18px 18px;
                box-shadow: 0 20px 50px rgba(0,0,0,0.55);
            }

            #settings-modal .settings-title {
                font: 800 18px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
                margin: 0 0 10px 0;
            }

            #settings-modal .settings-subtitle {
                margin: 0 0 14px 0;
                opacity: 0.8;
                font: 500 13px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
                line-height: 1.35;
            }

            #settings-modal .settings-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 10px 0;
            }

            #settings-modal .settings-row span {
                font: 700 14px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
            }

            #settings-close {
                margin-top: 10px;
                width: 100%;
                padding: 10px 12px;
                border-radius: 999px;
                border: 1px solid rgba(255,255,255,0.18);
                background: rgba(255,255,255,0.06);
                color: #fff;
                cursor: pointer;
                font: 800 14px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
            }

            #settings-close:hover {
                background: rgba(255,255,255,0.10);
            }
        `;
        document.head.appendChild(style);
    }

    function ensureSettingsUI() {
        ensureSettingsStyle();

        let btn = document.getElementById('settings-button');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'settings-button';
            btn.type = 'button';
            btn.textContent = '⚙ Nastavení';
            document.body.appendChild(btn);
        }

        let modal = document.getElementById('settings-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'settings-modal';
            modal.innerHTML = `
                <div class="settings-card" role="dialog" aria-modal="true" aria-label="Nastavení">
                    <div class="settings-title">Nastavení</div>
                    <div class="settings-subtitle">Globální nastavení se ukládají do tohoto prohlížeče.</div>
                    <div class="settings-row">
                        <span>Cenzura sprostých slov</span>
                        <input type="checkbox" id="censorship-toggle" />
                    </div>
                    <button id="settings-close" type="button">Zavřít</button>
                </div>
            `;
            document.body.appendChild(modal);
        }
    }

    function applyCensorship(enabled) {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const textNodes = [];
        let node;
        while ((node = walker.nextNode())) {
            if (
                node.parentElement &&
                ['SCRIPT', 'STYLE'].includes(node.parentElement.tagName)
            ) {
                continue;
            }
            if (node.parentElement && node.parentElement.closest('#settings-modal, #settings-button')) {
                continue;
            }
            if (node.nodeValue.trim() !== '') {
                 textNodes.push(node);
            }
        }

        textNodes.forEach(textNode => {
            const parent = textNode.parentElement;
            if (parent) {
                if (!parent.hasAttribute('data-original-text')) {
                    parent.setAttribute('data-original-text', textNode.nodeValue);
                }
                
                const originalText = parent.getAttribute('data-original-text');
                textNode.nodeValue = enabled ? censorText(originalText) : originalText;
            }
        });
    }

    window.globalCensorText = censorText;

    let censorshipEnabledState = true;
    
    const observer = new MutationObserver((mutations) => {
        if (!censorshipEnabledState) return;

        let shouldApply = false;
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                 if (mutation.target.closest && mutation.target.closest('#settings-modal, #settings-button')) {
                     continue;
                 }
                 shouldApply = true;
                 break;
            }
        }

        if (shouldApply) {
            observer.disconnect();
            applyCensorship(censorshipEnabledState);
            observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        }
    });


    function setCensorship(enabled) {
        censorshipEnabledState = enabled;
        localStorage.setItem('censorshipEnabled', enabled ? '1' : '0');
        
        observer.disconnect();
        applyCensorship(enabled);
        
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });

        const checkbox = document.getElementById('censorship-toggle');
        if (checkbox) {
            checkbox.checked = enabled;
        }
    }

    function initUI() {
        ensureSettingsUI();
        const btn = document.getElementById('settings-button');
        const modal = document.getElementById('settings-modal');
        const closeBtn = document.getElementById('settings-close');
        const checkbox = document.getElementById('censorship-toggle');

        if (!btn || !modal || !checkbox) return;

        btn.addEventListener('click', () => {
            modal.style.display = 'flex';
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        checkbox.addEventListener('change', () => {
            setCensorship(checkbox.checked);
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        const stored = localStorage.getItem('censorshipEnabled');
        const enabled = stored === null ? true : stored === '1';
        censorshipEnabledState = enabled;
        
        initUI();
        setCensorship(enabled);
    });
})();