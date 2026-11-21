const data = JSON.parse(document.getElementById("screen-data").textContent);
const image = document.getElementById("screen-image"),
  title = document.getElementById("screen-title"),
  description = document.getElementById("screen-description"),
  zoom = document.getElementById("zoom"),
  dialog = document.getElementById("lightbox");
const buttons = [...document.querySelectorAll("[data-screen]")];
function select(index) {
  const item = data[index];
  image.src = "assets/" + item[0] + ".png";
  const portrait = ["mobile", "report", "staff-mobile"].includes(item[0]);
  image.width = portrait ? 390 : 1440;
  image.height = portrait ? 844 : 1040;
  image.alt = item[1] + " — actual application UI with synthetic data";
  title.textContent = item[1];
  description.textContent = item[2];
  zoom.setAttribute("aria-label", "Enlarge " + item[1]);
  buttons.forEach((button, i) =>
    button.setAttribute("aria-pressed", String(i === index)),
  );
}
buttons.forEach((button, i) => {
  button.addEventListener("click", () => select(i));
  button.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (i + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) %
            buttons.length;
    select(next);
    buttons[next].focus();
  });
});
zoom.addEventListener("click", () => {
  const large = document.getElementById("large-image");
  large.src = image.src;
  large.alt = image.alt;
  dialog.showModal();
});
document
  .getElementById("close-lightbox")
  .addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
