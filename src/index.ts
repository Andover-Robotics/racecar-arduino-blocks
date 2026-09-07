import { mount } from "svelte";
import App from "./App.svelte";
import "./index.css";

const appTarget = document.getElementById("app");

if (!appTarget) {
  throw new Error("Element with id app was not found.");
}

mount(App, { target: appTarget });
