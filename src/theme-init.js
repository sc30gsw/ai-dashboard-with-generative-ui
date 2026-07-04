(function () {
  try {
    var t = localStorage.getItem("heroui-theme") || "system";
    var d =
      t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var c = d ? "dark" : "light";
    var e = document.documentElement;
    e.classList.remove("light", "dark");
    e.classList.add(c);
    e.setAttribute("data-theme", c);
  } catch {}
})();
