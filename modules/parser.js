export default class OptolithParser extends Application {
    //TODO species

    constructor(json) {
        super()
        this.json = json
    }

    async singleFetch(file, id) {
        return (await this.allFetch(file))[id] || ""
    }

    async allFetch(file) {
        return (await (await fetch(`./modules/dsa5-optolith/modules/data/ids/${game.i18n.lang}/${file}.json`)).json())
    }

    async parse() {
        const folder = await game.dsa5.apps.DSA5_Utility.getFolderForType("Actor", null, "Optolith")
        const errors = {}
        const oData = await this.allFetch("odata")
        const species =  oData["species"][this.json.r]
        const culture = oData["culture"][this.json.c]
        const career = oData["profession"][this.json.p][this.json.sex] || oData["profession"][this.json.p]
        const talents = oData["skill"]
        const combatskills = oData["combatskill"]

        const actor = {
            name: this.json.name,
            folder: folder.id,
            type: "character",
            system: {
                characteristics: {},
                status: {
                    wounds: { advances: this.json.attr?.lp || 0 },
                    karmaenergy: { 
                        advances: this.json.attr?.ae || 0,
                        permanentLoss: this.json.attr?.permanentKP?.lost || 0,
                        rebuy: this.json.attr?.permanentKP?.redeemed || 0
                    },
                    astralenergy: { 
                        advances: this.json.attr?.kp || 0,
                        permanentLoss: this.json.attr?.permanentAE?.lost || 0,
                        rebuy: this.json.attr?.permanentAE?.redeemed || 0
                    }
                },
                details : {
                    age: { value: this.json.pers?.age || ""},
                    species: { value: species},
                    gender: {value: this.json.sex || ""},
                    culture: { value: culture},
                    career: { value: career},
                    home: {value: this.json.pers?.placeofbirth || ""},
                    family: {value: this.json.pers?.family || ""},
                    haircolor: { value: oData["haircolor"][this.json.pers?.haircolor] || ""},
                    eyecolor: { value: oData["eyecolor"][this.json.pers?.eyecolor] || ""},
                    socialstate : { value: oData["socialstatus"][this.json.pers?.socialstatus] || ""},
                    height: { value: this.json.pers?.height || ""},
                    weight: { value: this.json.pers?.weight || ""},
                    distinguishingmark: { value: this.json.pers?.characteristics || ""},                    
                    experience: {
                        total: this.json.ap?.total || 0,                        
                    }
                }
            }
        }

        const attrs = ["mu", "kl", "in", "ch", "ff", "ge", "ko", "kk"]
        for(let attr of this.json.attr.values) {
            const id  = Number(attr.id.split("_")[1]) - 1
            actor.system.characteristics[attrs[id]] = { advances: attr.value - 8 }
        }
        
        const createdActor = await game.dsa5.entities.Actordsa5.create(actor, { render: false })

        const itemUpdates = []
        for(let [id, value] of Object.entries(this.json.talents)) {
            const talent = createdActor.items.find(x => x.name == talents[id] && x.type == "skill")

            if(talent) {
                itemUpdates.push({
                    _id: talent.id,
                    system: {
                        talentValue: {value: value }
                    }
                })
            } else {
                if(!errors["skill"])
                    errors["skill"] = []

                errors["skill"].push(`${talents[id]} (${id}: ${value}) not found`)
            }
        }
        for(let [id, value] of Object.entries(this.json.ct)) {
            const talent = createdActor.items.find(x => x.name == combatskills[id] && x.type == "combatskill")

            if(talent) {
                itemUpdates.push({
                    _id: talent.id,
                    system: {
                        talentValue: {value: value }
                    }
                })
            } else {
                if(!errors["combatskill"])
                    errors["combatskill"] = []

                errors["combatskill"].push(`${combatskills[id]} (${id}: ${value}) not found`)
            }
        }

        const itemCreations = []

        await game.dsa5.itemLibrary.buildEquipmentIndex()

        if(this.json.spells != {}) {
            const spells = oData["spell"]
            const rituals = oData["ritual"]

            for(let [id, value] of Object.entries(this.json.spells)) {
                let spell = spells[id]
                let isSpell = "spell"

                if(!spell) {
                    spell = rituals[id]
                    isSpell = "ritual"
                }

                if(spell) {
                    const find = (await game.dsa5.itemLibrary.findCompendiumItem(spell, isSpell))
                        .find(x => x.type == (isSpell))

                    if(find) {
                        const obj = find.toObject()
                        obj.system.talentValue.value = value
                        itemCreations.push(obj)
                    }else {
                        if(!errors[isSpell])
                            errors[isSpell] = []

                        errors[isSpell].push(`${spell} not found in library. Please add it manually.`)
                    }                    
                } else {
                    if(!errors["spell"])
                        errors["spell"] = []

                    errors["spell"].push(`${id}: ${value} not found`)
                }
            }
        }

        if(this.json.liturgies != {}) {
            const spells = oData["liturgy"]

            for(let [id, value] of Object.entries(this.json.liturgies)) {
                let spell = spells[id]

                if(spell) {
                    let find = (await game.dsa5.itemLibrary.findCompendiumItem(spell, "liturgy"))
                        .find(x => x.type == "liturgy")
                    
                    if(!find) 
                        find = (await game.dsa5.itemLibrary.findCompendiumItem(spell, "ceremony"))
                            .find(x => x.type == "ceremony")

                    if(find) {
                        const obj = find.toObject()
                        obj.system.talentValue.value = value
                        itemCreations.push(obj)
                    }else {
                        if(!errors["liturgy"])
                            errors["liturgy"] = []

                        errors["liturgy"].push(`${spell} not found in library. Please add it manually.`)
                    }                    
                } else {
                    if(!errors["liturgy"])
                        errors["liturgy"] = []

                    errors["liturgy"].push(`${id}: ${value} not found`)
                }
            }
        }

        if(this.json.cantrips.length) {
            const spells = oData["magictrick"]

            for(let id of this.json.cantrips) {
                let spell = spells[id]

                if(spell) {
                    const find = (await game.dsa5.itemLibrary.findCompendiumItem(spell, "magictrick"))
                        .find(x => x.type == "magictrick")

                    if(find) {
                        const obj = find.toObject()
                        itemCreations.push(obj)
                    }else {
                        if(!errors["magictrick"])
                            errors["magictrick"] = []

                        errors["magictrick"].push(`${spell} not found in library. Please add it manually.`)
                    }                    
                } else {
                    if(!errors["magictrick"])
                        errors["magictrick"] = []

                    errors["magictrick"].push(`${id} not found`)
                }
            }
        }
        if(this.json.blessings.length) {
            const spells = oData["blessing"]

            for(let id of this.json.blessings) {
                let spell = spells[id]

                if(spell) {
                    const find = (await game.dsa5.itemLibrary.findCompendiumItem(spell, "blessing"))
                        .find(x => x.type == "blessing")

                    if(find) {
                        const obj = find.toObject()
                        itemCreations.push(obj)
                    }else {
                        if(!errors["blessing"])
                            errors["blessing"] = []

                        errors["blessing"].push(`${spell} not found in library. Please add it manually.`)
                    }                    
                } else {
                    if(!errors["blessing"])
                        errors["blessing"] = []

                    errors["blessing"].push(`${id} not found`)                    
                }
            }
        }

        if(this.json.activatable != {}) {
            
            const source = {
                advantage: oData["advantage"],
                disadvantage: oData["disadvantage"],
                specialability: oData["specialability"]
            }

            for(let [id, value] of Object.entries(this.json.activatable)) {
                const type = { "ADV": "advantage", "DISADV": "disadvantage", "SA": "specialability" }[id.split("_")[0]]

                if(type) {
                    for(let val of value) {
                        let searchId  = id
                        let nameAdd 

                        if(val.sid) {
                            if(/^[0-9]+$/.test(val.sid)) {
                                searchId = `${id}_${val.sid}`                                
                            } 
                            else if(!(/^(LITURGY|SPELL)_\d+$/.test(val.sid))){
                                nameAdd = talents[val.sid] || combatskills[val.sid] || val.sid
                            }
                        }

                        let ability = source[type][searchId]

                        if(ability) {
                            if(nameAdd) {
                                ability = ability.split(" (")[0] + "()"
                            }

                            const find = (await game.dsa5.itemLibrary.findCompendiumItem(ability, type))
                                .find(x => x.type == type)

                            if(find) {
                                const obj = find.toObject()
                                if(val.tier) {
                                    const max = getProperty(obj.system, "max.value") || getProperty(obj.system, "maxRank.value") || 1
                                    obj.system.step.value = Math.min(max, val.tier)
                                }
                                
                                if(nameAdd) {
                                    obj.name = `${obj.name.split(" (")[0]} (${nameAdd})`
                                }

                                itemCreations.push(obj)
                            }else {
                                if(!errors[type])
                                    errors[type] = []

                                errors[type].push(`${ability} not found in library. Please add it manually.`)
                            }
                            
                        } else {                     
                            if(!errors[type])
                                errors[type] = []

                            errors[type].push(`${id}: ${val} not found`)
                        }
                    }
                } else {
                    if(!errors["specialability"])
                        errors["specialability"] = []

                    errors["specialability"].push(`${id}: ${value} not found`)                
                }
            }
        }

        for(let [key, value] of Object.entries(this.json.belongings.purse)) {
            if(value) {
                const money = createdActor.items.find(x => x.name == `Money-${key.toUpperCase()}` && x.type == "money")
                if(money) {
                    itemUpdates.push({
                        _id: money.id,
                        system: {
                            quantity: { value }
                        }
                    })
                
                }
            }
        }

        for(let item of Object.values(this.json.belongings.items)) {
            const type = {
                1: "meleeweapon",
                2: "rangeweapon",
                3: "ammunition",
                4: "armor",
                21: "poison",
                20: "consumable"
            }[item.gr] || "equipment"

            const find = (await game.dsa5.itemLibrary.findCompendiumItem(item.name, type))
                .find(x => x.type == type)

            if(find) {
                const obj = find.toObject()
                obj.system.quantity.value = item.amount
                itemCreations.push(obj)
            }else {
                if(!errors[type])
                    errors[type] = []

                errors[type].push(`${item.name} not found in library. Please add it manually.`)
            }
        }

        await createdActor.updateEmbeddedDocuments("Item", itemUpdates)
        await createdActor.createEmbeddedDocuments("Item", itemCreations)

        if(!Object.keys(errors).length) {
            errors["none"] = ["No errors during import"]            
        }

        const res = Object.entries(errors).map(([key, value]) => {
            return `<h3>${game.i18n.localize(`TYPES.Item.${key}`)}</h3><p>${value.join("<br/>")}</p>`
        }).join("")

        await createdActor.update({ 
            system: {
                details: {
                    biography: { value: `${res}` }
                },
                status: {
                    wounds: { value: createdActor.system.status.wounds.max },
                    karmaenergy: { value: createdActor.system.status.karmaenergy.max },
                    astralenergy: { value: createdActor.system.status.astralenergy.max }
                }
            }
         })

        ui.notifications.info(`Import of ${actor.name} complete!`)
        createdActor.sheet.render(true)
    }    

    static async openDialog() {
        new Dialog({
            title: `Import Data: Optolith`,
            content: await renderTemplate("templates/apps/import-data.html", {
              hint1: game.i18n.format("Optolith.hint1", {document: "Optolith"}),
              hint2: game.i18n.format("Optolith.hint2", {name: "Optolith"})
            }),
            buttons: {
              import: {
                icon: '<i class="fas fa-file-import"></i>',
                label: "Import",
                callback: html => {
                  const form = html.find("form")[0];
                  if ( !form.data.files.length ) return ui.notifications.error("You did not upload a data file!");
                  readTextFromFile(form.data.files[0]).then(text => 
                    {
                        const json = JSON.parse(text)
                        new OptolithParser(json).parse()
                    })                  
                   
                }
              },
              optolith: {
                icon: '<i class="fas fa-download"></i>',
                label: "Get Optolith",
                callback: () => {
                    window.open("https://optolith.app/")
                }
              },
              no: {
                icon: '<i class="fas fa-times"></i>',
                label: "Cancel"
              }
            },
            default: "import"
          }, {
            width: 400
          }).render(true);
    }
}