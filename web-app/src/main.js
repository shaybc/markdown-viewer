import { getDom } from "./app/dom.js";
import { createAppState } from "./app/state.js";
import { initLegacyApp } from "../script.js";

document.addEventListener("DOMContentLoaded", () => {
  const dom = getDom();
  const state = createAppState();

  initLegacyApp({ dom, state });
});
