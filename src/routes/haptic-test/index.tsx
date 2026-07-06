// Temporary on-device test page for isolating which switch-toggle haptic
// variants iOS actually plays. Remove once the haptics investigation is done.

import type { QwikJSX } from "@builder.io/qwik";
import { component$, useStylesScoped$, useVisibleTask$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

const styles = `
  .haptic-test {
    min-height: 100vh;
    padding: 16px;
    background: #050505;
    color: #f4f4f4;
    font-family: -apple-system, sans-serif;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }
  .haptic-test button,
  .haptic-test .overlay-host {
    display: block;
    width: 100%;
    margin: 12px 0;
    padding: 18px;
    font-size: 16px;
    background: #222;
    color: #f4f4f4;
    border: 1px solid #555;
    border-radius: 8px;
    text-align: center;
    box-sizing: border-box;
    touch-action: manipulation;
  }
  .haptic-test .overlay-host {
    position: relative;
    background: #143;
    border-color: #585;
  }
  .haptic-test .log {
    font-size: 13px;
    color: #999;
    white-space: pre-wrap;
  }
`;

export default component$((): QwikJSX.Element => {
  useStylesScoped$(styles);

  useVisibleTask$(({ cleanup }): void => {
    const logElement = document.getElementById("haptic-test-log");
    const log = (message: string): void => {
      if (logElement) logElement.textContent += `${message}\n`;
    };

    log(`secure context: ${window.isSecureContext}`);
    log(`vibration api: ${typeof navigator.vibrate === "function"}`);
    log(`ua: ${navigator.userAgent}`);

    // Rendered-but-invisible switch, identical to the homepage
    // implementation: display: none silences the toggle haptic, so the
    // switch hides as a transparent 1px box instead.
    const container = document.createElement("label");
    const input = document.createElement("input");

    Object.assign(container.style, {
      insetBlockEnd: "0",
      insetInlineStart: "0",
      opacity: "0",
      overflow: "hidden",
      blockSize: "1px",
      inlineSize: "1px",
      padding: "0",
      pointerEvents: "none",
      position: "fixed",
      zIndex: "-1",
    });
    container.ariaHidden = "true";
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    input.style.all = "initial";
    input.style.appearance = "auto";
    container.append(input);
    document.body.append(container);

    let ticks = 0;
    const tick = (): void => {
      container.click();
      ticks += 1;
    };

    // 5: real overlay switch (ios-haptics v3 style) toggled by the tap itself.
    const overlayHost = document.getElementById("haptic-test-overlay");
    const overlayInput = document.createElement("input");

    overlayInput.type = "checkbox";
    overlayInput.setAttribute("switch", "");
    Object.assign(overlayInput.style, {
      cursor: "pointer",
      height: "100%",
      left: "0",
      margin: "0",
      opacity: "0",
      position: "absolute",
      top: "0",
      touchAction: "manipulation",
      width: "100%",
    });
    overlayInput.addEventListener("change", (): void => log("5: native switch toggled"));
    overlayHost?.append(overlayInput);

    // 6: exact replica of stentorian.io's web-haptics setup — explicit
    // for/id association, label text, library styles, then their CSS hiding
    // override (no aria-hidden, no pointer-events: none).
    const createStentorianSwitch = (id: string): HTMLLabelElement => {
      const label = document.createElement("label");
      const switchInput = document.createElement("input");

      label.setAttribute("for", id);
      label.textContent = "Haptic feedback";
      Object.assign(label.style, {
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        borderRadius: "4px",
        bottom: "10px",
        color: "white",
        fontFamily: "sans-serif",
        fontSize: "14px",
        left: "10px",
        padding: "5px 10px",
        position: "fixed",
        userSelect: "none",
        zIndex: "9999",
      });
      switchInput.type = "checkbox";
      switchInput.setAttribute("switch", "");
      switchInput.id = id;
      switchInput.style.all = "initial";
      switchInput.style.appearance = "auto";
      label.append(switchInput);
      document.body.append(label);

      return label;
    };

    const stentorianLabel = createStentorianSwitch("haptic-test-stentorian");
    Object.assign(stentorianLabel.style, {
      blockSize: "1px",
      inlineSize: "1px",
      insetBlockEnd: "0",
      insetInlineStart: "0",
      opacity: "0",
      overflow: "hidden",
      padding: "0",
      zIndex: "-1",
    });

    // 7: same construction but fully visible (bottom-right pill), still
    // clicked programmatically.
    const visibleLabel = createStentorianSwitch("haptic-test-visible");
    visibleLabel.style.left = "auto";
    visibleLabel.style.right = "10px";

    const onStentorianTick = (): void => {
      stentorianLabel.click();
      log("6: stentorian-replica ticked");
    };

    const onVisibleTick = (): void => {
      visibleLabel.click();
      log("7: visible switch ticked");
    };

    const intervals = new Set<number>();
    const setTrackedInterval = (handler: () => void, ms: number): number => {
      const interval = window.setInterval(handler, ms);

      intervals.add(interval);
      return interval;
    };

    const onTapTick = (): void => {
      tick();
      log(`1: ticked on click (total ${ticks})`);
    };

    const onDownTick = (): void => {
      tick();
      log(`2: ticked on pointerdown (total ${ticks})`);
    };

    let holdInterval = 0;
    const onHoldStart = (): void => {
      window.clearInterval(holdInterval);
      holdInterval = setTrackedInterval(tick, 150);
      log("3: hold loop started");
    };
    const onHoldStop = (): void => {
      window.clearInterval(holdInterval);
      log(`3: hold loop stopped (total ${ticks})`);
    };

    const onTapLoop = (): void => {
      log("4: post-tap loop started");

      let count = 0;
      const interval = setTrackedInterval((): void => {
        tick();
        count += 1;

        if (count >= 13) {
          window.clearInterval(interval);
          log(`4: post-tap loop done (total ${ticks})`);
        }
      }, 150);
    };

    const tapTickButton = document.getElementById("haptic-test-tap-tick");
    const downTickButton = document.getElementById("haptic-test-down-tick");
    const holdLoopButton = document.getElementById("haptic-test-hold-loop");
    const tapLoopButton = document.getElementById("haptic-test-tap-loop");
    const stentorianButton = document.getElementById("haptic-test-stentorian-tick");
    const visibleButton = document.getElementById("haptic-test-visible-tick");

    tapTickButton?.addEventListener("click", onTapTick);
    downTickButton?.addEventListener("pointerdown", onDownTick);
    holdLoopButton?.addEventListener("pointerdown", onHoldStart);
    holdLoopButton?.addEventListener("pointerup", onHoldStop);
    holdLoopButton?.addEventListener("pointercancel", onHoldStop);
    tapLoopButton?.addEventListener("click", onTapLoop);
    stentorianButton?.addEventListener("click", onStentorianTick);
    visibleButton?.addEventListener("click", onVisibleTick);

    cleanup(() => {
      for (const interval of intervals) {
        window.clearInterval(interval);
      }

      tapTickButton?.removeEventListener("click", onTapTick);
      downTickButton?.removeEventListener("pointerdown", onDownTick);
      holdLoopButton?.removeEventListener("pointerdown", onHoldStart);
      holdLoopButton?.removeEventListener("pointerup", onHoldStop);
      holdLoopButton?.removeEventListener("pointercancel", onHoldStop);
      tapLoopButton?.removeEventListener("click", onTapLoop);
      stentorianButton?.removeEventListener("click", onStentorianTick);
      visibleButton?.removeEventListener("click", onVisibleTick);
      overlayInput.remove();
      container.remove();
      stentorianLabel.remove();
      visibleLabel.remove();
    });
  });

  return (
    <div class="haptic-test">
      <h3>Haptic isolation test</h3>
      <button id="haptic-test-tap-tick" type="button">
        1: Tick on tap (click event)
      </button>
      <button id="haptic-test-down-tick" type="button">
        2: Tick on finger DOWN (hold it)
      </button>
      <button id="haptic-test-hold-loop" type="button">
        3: Tick loop WHILE holding
      </button>
      <button id="haptic-test-tap-loop" type="button">
        4: Tap once, loop for 2s after release
      </button>
      <div class="overlay-host" id="haptic-test-overlay">
        5: Real switch overlay (tap me)
      </div>
      <button id="haptic-test-stentorian-tick" type="button">
        6: Tick stentorian-replica switch on tap
      </button>
      <button id="haptic-test-visible-tick" type="button">
        7: Tick VISIBLE switch on tap (see bottom-right)
      </button>
      <div class="log" id="haptic-test-log">
        log:{"\n"}
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Haptic test",
};
