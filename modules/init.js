import OptolithParser from "./parser.js"

Hooks.once("ready", () => {
    game.dsa5.optolith = OptolithParser
})

Hooks.on("renderActorDirectory", (app, html, data) => {
    if (game.user.can("create")) {
        const button = $(`<button data-tooltip="Optolith.hint1"><i class="fas fa-file-import"></i>Optolith</button>`)
        html.find(".header-actions").append(button)
        button.click(() => { game.dsa5.optolith.openDialog() });       
    }
})