
const RG = require('./rg.js');

RG.ObjectShell = {};

RG.ObjectShell.Creator = function(db, dbNoRandom) {
    const _db = db;
    const _dbNoRandom = dbNoRandom;

    /* Maps obj props to function calls. Essentially this maps bunch of setters
     * to different names. Following formats supported:
     *
     * 1. {factory: funcObj, func: "setter"}
     *  Call obj["setter"]( funcObj(shell.field) )
     *
     * 2. {comp: "CompName", func: "setter"}
     *  Create component comp of type "CompName".
     *  Call comp["setter"]( shell.field)
     *  Call obj.add("CompName", comp)
     *
     * 3. {comp: "CompName"}
     *  Create component comp of type "CompName" with new CompName(shell.field)
     *  Call obj.add("CompName", comp)
     *
     * 4. "setter"
     *   Call setter obj["setter"](shell.field)
     * */
    const _propToCall = {
        actors: {
            type: 'setType',
            attack: {comp: 'Combat', func: 'setAttack'},
            defense: {comp: 'Combat', func: 'setDefense'},
            damage: {comp: 'Combat', func: 'setDamageDie'},
            speed: {comp: 'Stats', func: 'setSpeed'},

            strength: {comp: 'Stats', func: 'setStrength'},
            accuracy: {comp: 'Stats', func: 'setAccuracy'},
            agility: {comp: 'Stats', func: 'setAgility'},
            willpower: {comp: 'Stats', func: 'setWillpower'},

            pp: {comp: 'SpellPower', func: 'setPP'},
            maxPP: {comp: 'SpellPower', func: 'setMaxPP'},
            hp: {comp: 'Health'},
            danger: {comp: 'Experience', func: 'setDanger'},
            brain: {func: 'setBrain', factory: RG.FACT.createBrain}
        },
        items: {
            // Generic item functions
            value: 'setValue',
            weight: {comp: 'Physical', func: 'setWeight'},

            armour: {
                attack: 'setAttack',
                defense: 'setDefense',
                protection: 'setProtection',
                armourType: 'setArmourType'
            },

            weapon: {
                damage: 'setDamageDie',
                attack: 'setAttack',
                defense: 'setDefense'
            },
            missile: {
                damage: 'setDamageDie',
                attack: 'setAttack',
                range: 'setAttackRange'
            },
            food: {
                energy: 'setEnergy'
            }
        }
    };

    _propToCall.items.missileweapon = _propToCall.items.missile;
    _propToCall.items.ammo = _propToCall.items.missile;

    /* Returns an object shell, given category and name.*/
    this.get = (categ, name) => {
        if (_dbNoRandom[categ][name]) {
            return _dbNoRandom[categ][name];
        }
        return _db[categ][name];
    };

    /* Creates a component of specified type.*/
    this.createComponent = (type, val) => {
        switch (type) {
            case 'Combat': return new RG.Component.Combat();
            case 'Experience': return new RG.Component.Experience();
            case 'Health': return new RG.Component.Health(val);
            case 'Stats': return new RG.Component.Stats();
            default:
                if (RG.Component.hasOwnProperty(type)) {
                    return new RG.Component[type]();
                }
                else {
                    RG.err('ObjectShell.Creator', 'createComponent',
                        'Component |' + type + "| doesn't exist.");
                }
        }
        return null;
    };

    /* Returns an actual game object when given category and name. Note that
     * the blueprint must exist already in the database (blueprints must have
     * been parsed before). */
    this.createActualObj = function(categ, name) {
        const shell = this.get(categ, name);
        const propCalls = _propToCall[categ];
        if (!shell) {
            RG.err('ObjectShell.Creator', 'createActualObj',
                `shell for ${name} is not found.`);
        }

        const newObj = this.createNewObject(categ, shell);

        // If propToCall table has the same key as shell property, call
        // function in _propToCall using the newly created object.
        for (const p in shell) {

            // Called for basic type: actors, items...
            if (propCalls.hasOwnProperty(p)) {
                const funcName = propCalls[p];
                if (typeof funcName === 'object') {

                    // 1. Add new component to the object
                    if (funcName.hasOwnProperty('comp')) {
                        this.addCompToObj(newObj, funcName, shell[p]);
                    }
                    // 2. Or use factory to create an object and add it to the
                    // object. Only 'brain' supported for now.
                    else if (funcName.hasOwnProperty('factory')) {
                        if (p === 'brain') {
                            const createdObj
                                = funcName.factory(newObj, shell[p]);
                            newObj[funcName.func](createdObj);
                        }
                    }
                    // 3. Or call one of the object's methods with the value in
                    // the object shell
                    else {
                        for (const f in funcName) {
                            if (funcName.hasOwnProperty(f)) {
                                const fName = funcName[f];
                                if (newObj.hasOwnProperty(fName)) {
                                    newObj[fName](shell[p]);
                                }
                            }
                        }
                    }
                }
                else { // 4. For strings, call the setter 'funcName' directly
                    newObj[funcName](shell[p]);
                }
            }
            // Check for subtypes
            else if (shell.hasOwnProperty('type')) {

                // No idea what this mess of code does
                if (propCalls.hasOwnProperty(shell.type)) {
                    const propTypeCalls = propCalls[shell.type];
                    if (propTypeCalls.hasOwnProperty(p)) {
                        const funcName2 = propTypeCalls[p];
                        if (typeof funcName2 === 'object') {
                            for (const f2 in funcName2) {
                                if (funcName2.hasOwnProperty(f2)) {
                                    const fName2 = funcName2[f2];
                                    if (newObj.hasOwnProperty(fName2)) {
                                        newObj[funcName2[f2]](shell[p]);
                                    }
                                }
                            }
                        }
                        else {
                            newObj[funcName2](shell[p]);
                        }
                    }
                }
            }
        }

        if (shell.hasOwnProperty('use')) {this.addUseEffects(shell, newObj);}

        if (shell.hasOwnProperty('equip')) {
            this.addEquippedItems(shell, newObj);
        }

        if (shell.hasOwnProperty('inv')) {
            this.addInventoryItems(shell, newObj);
        }

        if (shell.hasOwnProperty('loot')) {
            this.addLootComponents(shell, newObj);
        }

        // Example: {name: 'bat', addComp: 'Flying'}
        if (shell.hasOwnProperty('addComp')) {
            this.addComponent(shell, newObj);
        }

        if (shell.hasOwnProperty('poison')) {
            this.addPoison(shell, newObj);
        }

        if (shell.hasOwnProperty('enemies')) {
            this.addEnemies(shell, newObj);
        }

        if (shell.hasOwnProperty('spells')) {
            this.addSpells(shell, newObj);
        }

        // TODO map different props to function calls
        return newObj;
    };

    this.addPoison = (shell, obj) => {
        const poison = shell.poison;
        const poisonComp = new RG.Component.Poison();
        poisonComp.setProb(poison.prob);
        poisonComp.setSource(obj);
        poisonComp.setDamageDie(RG.FACT.createDie(poison.damage));

        const dieDuration = RG.FACT.createDie(poison.duration);
        poisonComp.setDurationDie(dieDuration);
        const addOnHit = new RG.Component.AddOnHit();
        addOnHit.setComp(poisonComp);
        obj.add('AddOnHit', addOnHit);
    };

    this.addEnemies = (shell, obj) => {
        shell.enemies.forEach(enemyType => {
            obj.getBrain().addEnemyType(enemyType);
        });
    };

    this.addSpells = (shell, obj) => {
        obj.setBook(new RG.Spell.SpellBook());
        shell.spells.forEach(spell => {
            obj.getBook().addSpell(new RG.Spell[spell]());
        });
    };

    /* Factory-method for creating the actual game objects.*/
    this.createNewObject = (categ, obj) => {
        switch (categ) {
            case RG.TYPE_ACTOR:
                const type = obj.type;
                switch (type) {
                    case 'spirit': return new RG.Actor.Spirit(obj.name);
                    default: return new RG.Actor.Rogue(obj.name);
                }
            case RG.TYPE_ITEM:
                const subtype = obj.type;
                switch (subtype) {
                    case 'armour': return new RG.Item.Armour(obj.name);
                    case 'food': return new RG.Item.Food(obj.name);
                    case 'gold': return new RG.Item.Gold(obj.name);
                    case 'goldcoin' : return new RG.Item.GoldCoin(obj.name);
                    case 'missile': return new RG.Item.Missile(obj.name);
                    case 'missileweapon':
                        return new RG.Item.MissileWeapon(obj.name);
                    case 'ammo': return new RG.Item.Ammo(obj.name);
                    case 'potion': return new RG.Item.Potion(obj.name);
                    case 'spiritgem': return new RG.Item.SpiritGem(obj.name);
                    case 'weapon': return new RG.Item.Weapon(obj.name);
                    case 'tool': break;
                    default: {
                        const json = JSON.stringify(obj);
                        const msg =
                            `Unknown subtype: ${subtype}, obj: ${json}`;
                        RG.err('', 'createNewObject', msg);
                    }
                }
                return new RG.Item.Base(obj.name); // generic, useless
            default: break;
        }
        return null;
    };

    /* Adds a component to the newly created object, or updates existing
     * component if it exists already.*/
    this.addCompToObj = function(newObj, compData, val) {
        if (compData.hasOwnProperty('func')) {
            const fname = compData.func;
            const compName = compData.comp;
            if (newObj.has(compName)) {
                // 1. Call existing comp with setter (fname)
                newObj.get(compName)[fname](val);
            }
            else { // 2. Or create a new component
                const comp = this.createComponent(compName);
                comp[fname](val); // Then call comp setter
                newObj.add(compName, comp);
            }
        }
        else {
            newObj.add(compData.comp,
                this.createComponent(compData.comp, val));
        }

    };

    /* This function makes a pile of mess if used on non-entities. */
    this.addComponent = (shell, entity) => {
        if (typeof shell.addComp === 'string') {
            _addCompFromString(shell.addComp, entity);
        }
        else if (shell.addComp.hasOwnProperty('length')) {
            shell.addComp.forEach(comp => {
                if (typeof comp === 'string') {
                    _addCompFromString(comp, entity);
                }
                else {
                    _addCompFromObj(comp, entity);
                }
            });
        }
        else if (typeof shell.addComp === 'object') {
            _addCompFromObj(shell.addComp, entity);
        }
        else {
            RG.err('ObjectShell.Creator', 'addComponent',
                'Giving up. shell.addComp must be string, array or object.');
        }
    };

    const _addCompFromString = (compName, entity) => {
        try {
            const comp = new RG.Component[compName]();
            entity.add(compName, comp);
        }
        catch (e) {
            let msg = `shell.addComp |${compName}|`;
            msg += 'Component names are capitalized.';
            RG.err('ObjectShell.Creator', 'addComponent',
                `${e.message} - ${msg}`);
        }
    };

    const _addCompFromObj = function(compObj, entity) {
        this.addCompToObj(compObj, entity, null);
    };

    // Adds the inventory items for the actors which are specified with 'inv'
    this.addInventoryItems = function(shell, actor) {
        const inv = shell.inv;
        inv.forEach(item => {
            const name = item.name || item;
            const count = item.count || 1;
            const itemObj = this.createActualObj(RG.TYPE_ITEM, name);
            if (itemObj) {
                itemObj.count = count;
                actor.getInvEq().addItem(itemObj);
            }
            else {
                RG.err('ObjectShell.Creator', 'addInventoryItems',
                    `itemObj for ${name} is null. Actor: ${actor.getName()}`);
            }
        });
    };

    // Adds the loot component to the Actor object
    this.addLootComponents = function(shell, actor) {
        const loot = shell.loot;
        const lootItem = this.createActualObj(RG.TYPE_ITEM, loot);
        const lootComp = new RG.Component.Loot(lootItem);
        actor.add('Loot', lootComp);
    };

    /* Adds equipped items given with shell.equip into the actor. */
    this.addEquippedItems = function(shell, actor) {
        const equip = shell.equip;
        equip.forEach(item => {
            const itemName = item.name || item;
            const count = item.count || 1;
            const itemObj = this.createActualObj(RG.TYPE_ITEM, itemName);
            if (itemObj) {
                itemObj.count = count;
                actor.getInvEq().addItem(itemObj);
                if (count > 1) {
                    if (!actor.getInvEq().equipNItems(itemObj, count)) {
                        const actorName = actor.getName();
                        RG.err('ObjectShell.Creator', 'addEquippedItems',
                            `Cannot equip: ${count} ${item} to ${actorName}`);
                    }
                }
                else if (!actor.getInvEq().equipItem(itemObj)) {
                    RG.err('ObjectShell.Creator', 'addEquippedItems',
                        `Cannot equip: ${item} to ${actor.getName()}`);
                }
            }
            else {
                RG.err('ObjectShell.Creator', 'addEquippedItems',
                    `itemObj for ${item} is null. Actor: ${actor.getName()}`);
            }
        });
    };

    /* If shell has 'use', this adds specific use effect to the item.*/
    this.addUseEffects = (shell, newObj) => {
        newObj.useFuncs = [];
        newObj.useItem = _db.effects.use.func.bind(newObj);
        if (typeof shell.use === 'object'
            && shell.use.hasOwnProperty('length')) {
            for (let i = 0; i < shell.use.length; i++) {
                _addUseEffectToItem(shell, newObj, shell.use[i]);
            }
        }
        else if (typeof shell.use === 'object') {
            for (const p in shell.use) {
                if (shell.use.hasOwnProperty(p)) {
                    _addUseEffectToItem(shell, newObj, p);
                }
            }
        }
        else {
            _addUseEffectToItem(shell, newObj, shell.use);
        }
    };

    const _addUseEffectToItem = (shell, item, useName) => {
        const useFuncName = useName;
        if (_db.effects.hasOwnProperty(useFuncName)) {
            const useEffectShell = _db.effects[useFuncName];
            const useFuncVar = useEffectShell.func;
            item.useFuncs.push(useFuncVar);

            if (useEffectShell.hasOwnProperty('requires')) {
                if (shell.use.hasOwnProperty(useName)) {
                    item.useArgs = {};
                    const reqs = useEffectShell.requires;
                    if (typeof reqs === 'object') {
                        for (let i = 0; i < reqs.length; i++) {
                            _verifyAndAddReq(shell.use[useName], item, reqs[i]);
                        }
                    }
                    else {
                        _verifyAndAddReq(shell.use[useName], item, reqs);
                    }
                }
                else {
                    RG.err('ObjectParser', 'addUseEffects',
                        `useEffect shell has 'requires'.
                        Item shell 'use' must be an object.`
                    );
                }
            }
        }
        else {
            RG.err('ObjectParser', 'addUseEffects',
                'Unknown effect: |' + useFuncName + '|');
        }
    };

    /* Verifies that the shell has all requirements, and adds them to the
     * object, into useArgs.reqName. */
    const _verifyAndAddReq = (obj, item, reqName) => {
        if (obj.hasOwnProperty(reqName)) {
            item.useArgs[reqName] = obj[reqName];
        }
        else {
            RG.err('ObjectParser', '_verifyAndAddReq',
                `Req |${reqName}| not specified in item shell. Item: ${item}`);
        }
    };

    /* Creates actual game object from obj shell in given category.*/
    this.createFromShell = function(categ, obj) {
        if (obj) {
            return this.createActualObj(categ, obj.name);
        }
        else {
            RG.err('ObjectShell.Creator', 'createFromShell',
                'obj given must be defined.');
        }
        return null;
    };

};

/* Object handling the procedural generation. It has an object "database" and
 * objects can be pulled randomly from it. */
RG.ObjectShell.ProcGen = function(db, dbDanger, dbByName) {
    const _db = db;
    const _dbDanger = dbDanger;
    const _dbByName = dbByName;

    // Internal cache for proc generation
    const _cache = {
        actorWeights: {}
    };

    /* Returns entries from db based on the query. Returns null if nothing
     * matches.*/
    this.dbGet = query => {
        const name = query.name;
        const categ = query.categ;
        const danger = query.danger;
        // const type = query.type;

        // Specifying name returns an array
        if (!RG.isNullOrUndef([name])) {
            if (_dbByName.hasOwnProperty(name)) {return _dbByName[name];}
            else {return [];}
        }

        if (!RG.isNullOrUndef([danger])) {
            if (_dbDanger.hasOwnProperty(danger)) {
                const entries = _dbDanger[danger];
                if (typeof categ !== 'undefined') {
                    if (entries.hasOwnProperty(categ)) {
                        return entries[categ];
                    }
                    else {return {};}
                }
                else {
                    return _dbDanger[danger];
                }
            }
            else {
                return {};
            }
        }
        // Fetch all entries of given category
        else if (!RG.isNullOrUndef([categ])) {
            if (_db.hasOwnProperty(categ)) {
                return _db[categ];
            }
        }
        return {};

    };

    /* Filters given category with a function. Func gets each object as arg,
     * and must return either true or false. Function can be for example:
     *   1.func(obj) {if (obj.name === 'wolf') return true;} Or
     *   2.func(obj) {if (obj.hp > 25) return true;}.
     *   And it can be as complex as needed of course.
     * */
    this.filterCategWithFunc = function(categ, func) {
        const objects = this.dbGet({categ});
        const res = [];
        const keys = Object.keys(objects);

        for (let i = 0; i < keys.length; i++) {
            const name = keys[i];
            const obj = objects[name];
            const acceptItem = func(obj);
            if (acceptItem) {
                res.push(obj);
            }
        }
        return res;

    };

    //---------------------------------------------------
    // RANDOMIZED METHODS for procedural generation
    //---------------------------------------------------

    /* Returns random object from the db. For example, {categ: "actors",
     * danger: 2}
     * returns a random actors with these constrains.
     * Ex2: {danger: 3, num:1}
     * returns randomly one entry which has danger 3.*/
    this.dbGetRand = function(query) {
        const danger = query.danger;
        const categ = query.categ;
        if (typeof danger !== 'undefined') {
            if (typeof categ !== 'undefined') {
                if (_dbDanger.hasOwnProperty(danger)) {
                    const entries = _dbDanger[danger][categ];
                    return this.getRandFromObj(entries);
                }
            }
        }
        return null;
    };

    /* Creates a random actor based on danger value or a filter function.*/
    this.getRandomActor = function(obj) {
        if (obj.hasOwnProperty('danger')) {
            const danger = obj.danger;
            const randShell = this.dbGetRand({danger, categ: RG.TYPE_ACTOR});
            if (randShell !== null) {
                return randShell;
            }
        }
        else if (obj.hasOwnProperty('func')) {
            const res = this.filterCategWithFunc( RG.TYPE_ACTOR, obj.func);
            return RG.RAND.arrayGetRand(res);
        }
        return null;
    };

    /* Returns a random item based on a selection function.
     *
     * Example:
     *  const funcValueSel = function(item) {return item.value >= 100;}
     *  const item = createRandomItem({func: funcValueSel});
     *  // Above returns item with value > 100.
     */
    this.getRandomItem = function(obj) {
        if (obj.hasOwnProperty('func')) {
            const res = this.filterCategWithFunc('items', obj.func);
            return RG.RAND.arrayGetRand(res);
        }
        else {
            RG.err('ObjectShell.ProcGen', 'getRandomItem',
                `No function with func. obj arg: ${JSON.stringify(obj)}`);
        }
        return null;
    };

    // Uses engine's internal weighting algorithm when given a level number.
    // Note that this method can return null, if no correct danger level is
    // found. You can supply {func: ...} as a fallback solution.
    this.getRandomActorWeighted = function(min, max) {
        const key = min + ',' + max;
        if (!_cache.actorWeights.hasOwnProperty(key)) {
            _cache.actorWeights[key] = RG.getDangerProb(min, max);
        }
        const danger = RG.RAND.getWeighted(_cache.actorWeights[key]);
        const actor = this.getRandomActor({danger});
        return actor;
    };

    /* Returns a property from an object, selected randomly. For example,
     * given object {a: 1, b: 2, c: 3}, may return 1,2 or 3 with equal
     * probability.*/
    this.getRandFromObj = obj => {
        const keys = Object.keys(obj);
        const randIndex = RG.RAND.randIndex(keys);
        return obj[keys[randIndex]];
    };
};

/* Object parser for reading game data. Game data is contained within shell
 * objects which are simply object literals without functions etc. */
RG.ObjectShell.Parser = function() {

    // NOTE: 'SHELL' means vanilla JS object, which has not been
    // created with new:
    //      SHELL:   const rat = {name: "Rat", type: "animal"};
    //      OBJECT: const ratObj = new RG.Actor.Rogue("rat");
    //              ratObj.setType("animal");
    //
    // Shells are used in external data file to describe game objects in a more
    // concise way. Game objects are created from shells by this object.

    // Stores the base shells
    const _base = {
        actors: {},
        effects: {},
        items: {}
    };

    const _db = {
        actors: {},
        effects: {},
        items: {}
    };

    const _dbDanger = {}; // All entries indexed by danger
    const _dbByName = {}; // All entries indexed by name

    const _dbNoRandom = {
        actors: {},
        items: {}
    }; // All entries excluded from random generation

    const _creator = new RG.ObjectShell.Creator(_db, _dbNoRandom);
    const _procgen = new RG.ObjectShell.ProcGen(_db, _dbDanger, _dbByName);

    //-----------------------------------------------------------------------
    // "PARSING" METHODS
    //-----------------------------------------------------------------------

    /* Parses all shell data, items, monsters, level etc.*/
    this.parseShellData = function(obj) {
        const keys = Object.keys(obj);
        for (let i = 0; i < keys.length; i++) {
            this.parseShellCateg(keys[i], obj[keys[i]]);
        }
    };

    /* Parses one specific shell category, ie items or monsters.*/
    this.parseShellCateg = function(categ, objsArray) {
        for (let i = 0; i < objsArray.length; i++) {
            this.parseObjShell(categ, objsArray[i]);
        }
    };

    /* Parses an object shell. Returns null for invalid objects, and
     * corresponding object for actual actors. If 'base' property exists,
     * all base properties will be added to the returned object.
     * */
    this.parseObjShell = function(categ, obj) {
        if (this.validShellGiven(obj)) {
            // Get properties from base shell
            if (obj.hasOwnProperty('base')) {
                const baseShells = typeof obj.base === 'string' ? [obj.base]
                    : obj.base;
                baseShells.forEach(bName => {
                    if (this.baseExists(categ, bName)) {
                        obj = this.extendObj(obj, this.getBase(categ, bName));
                    }
                    else {
                        RG.err('ObjectParser', 'parseObjShell',
                            'Unknown base ' + bName + ' specified for '
                            + JSON.stringify(obj));
                    }
                });
            }

            // If type not given, use name as type
            if (categ === RG.TYPE_ACTOR) {this.addTypeIfUntyped(obj);}

            this.storeIntoDb(categ, obj);
            return obj;
        }
        else {
            return null;
        }
    };

    /* Checks that the object shell given is correctly formed.*/
    this.validShellGiven = obj => {
        if (!obj.hasOwnProperty('name')) {
            RG.err('ObjectShell.Parser', 'validShellGiven',
                "shell doesn't have a name.");
            return false;
        }
        return true;
    };

    /* If an object doesn't have type, the name is chosen as its type.*/
    this.addTypeIfUntyped = obj => {
        if (!obj.hasOwnProperty('type')) {
            obj.type = obj.name;
        }
    };

    /* Returns an object shell, given category and name.*/
    this.get = (categ, name) => _db[categ][name];

    /* Return specified base shell.*/
    this.getBase = (categ, name) => _base[categ][name];

    /* All shells can be used as base, not only ones with
     * 'dontCreate: true' */
    this.storeForUsingAsBase = (categ, obj) => {
        _base[categ][obj.name] = obj;
    };

    /* Stores the object into given category.*/
    this.storeIntoDb = function(categ, obj) {
        if (_db.hasOwnProperty(categ)) {
            this.storeForUsingAsBase(categ, obj);

            if (obj.hasOwnProperty('noRandom')) {
                _dbNoRandom[categ][obj.name] = obj;
            }
            else if (!obj.hasOwnProperty('dontCreate')) {
                if (_dbByName.hasOwnProperty(obj.name)) {
                    _dbByName[obj.name].push(obj);
                }
                else {
                    const newArr = [];
                    newArr.push(obj);
                    _dbByName[obj.name] = newArr;
                }

                _db[categ][obj.name] = obj;
                if (obj.hasOwnProperty('danger')) {
                    const danger = obj.danger;
                    if (!_dbDanger.hasOwnProperty(danger)) {
                        _dbDanger[danger] = {};
                    }
                    if (!_dbDanger[danger].hasOwnProperty(categ)) {
                        _dbDanger[danger][categ] = {};
                    }
                    _dbDanger[danger][categ][obj.name] = obj;
                }

            } // dontCreate: true shells are skipped (used as base)
        }
        else {
            RG.err('ObjectParser', 'storeIntoDb',
                'Unknown category: ' + categ);
        }
        this.storeRenderingInfo(categ, obj);
    };

    /* Stores char/CSS className for the object for rendering purposes.*/
    this.storeRenderingInfo = (categ, obj) => {
        if (obj.hasOwnProperty('char')) {
            if (obj.hasOwnProperty('name')) {
                RG.addCharStyle(categ, obj.name, obj.char);
                if (obj.dontCreate) {
                    RG.addCharStyle(categ, obj.type, obj.char);
                }
            }
            else {
                RG.addCharStyle(categ, obj.type, obj.char);
            }
        }
        if (obj.hasOwnProperty('className')) {
            if (obj.hasOwnProperty('name')) {
                RG.addCellStyle(categ, obj.name, obj.className);
                if (obj.dontCreate) {
                    RG.addCellStyle(categ, obj.type, obj.className);
                }
            }
            else {
                RG.addCellStyle(categ, obj.type, obj.className);
            }
        }
    };

    /* Returns true if shell base exists.*/
    this.baseExists = (categ, baseName) => {
        if (_base.hasOwnProperty(categ)) {
            return _base[categ].hasOwnProperty(baseName);
        }
        return false;
    };

    /* Extends the given object shell with a given base shell.*/
    this.extendObj = (obj, baseObj) => {
        for (const prop in baseObj) {
            if (!obj.hasOwnProperty(prop)) {
                if (prop !== 'dontCreate') {
                    obj[prop] = baseObj[prop];
                }
            }
        }
        return obj;
    };


    //---------------------------------------------------------------
    // CREATE METHODS (to be removed, but kept now because removing
    //   these would break the API in major way)
    //---------------------------------------------------------------

    this.createActor = function(name) {
        return this.createActualObj(RG.TYPE_ACTOR, name);
    };

    this.createItem = function(name) {
        return this.createActualObj(RG.TYPE_ITEM, name);
    };

    /* Returns an actual game object when given category and name. Note that
     * the shell must exist already in the database (shell must have
     * been parser before). */
    this.createActualObj = function(categ, name) {
        if (!this.dbExists(categ, name)) {
            RG.err('ObjectShell.Parser', 'createActualObj',
                'Categ: ' + categ + ' Name: ' + name + " doesn't exist.");
            return null;
        }
        return _creator.createActualObj(categ, name);
    };

    /* Creates actual game object from obj shell in given category.*/
    this.createFromShell = (categ, obj) => _creator.createFromShell(categ, obj);

    //--------------------------------------------------------------------
    // Query methods for object shells
    //--------------------------------------------------------------------

    this.dbExists = (categ, name) => {
        if (_db.hasOwnProperty(categ)) {
            if (_db[categ].hasOwnProperty(name)) {
                return true;
            }
        }
        if (_dbNoRandom[categ][name]) {
            return true;
        }
        return false;
    };

    /* Returns entries from db based on the query. Returns null if nothing
     * matches.*/
    this.dbGet = query => _procgen.dbGet(query);

    this.dbGetRand = query => _procgen.dbGetRand(query);

    //----------------------------------------------------------------------
    // RANDOMIZED METHODS for procedural generation
    //----------------------------------------------------------------------

    /* Creates a random actor based on danger value or a filter function.*/
    this.createRandomActor = obj => {
        const randShell = _procgen.getRandomActor(obj);
        if (randShell) {
            return _creator.createFromShell(RG.TYPE_ACTOR, randShell);
        }
        return null;
    };

    // Uses engine's internal weighting algorithm when given a level number.
    // Note that this method can return null, if no correct danger level is
    // found. You can supply {func: ...} as a fallback solution.
    this.createRandomActorWeighted = function(min, max, obj) {
        const actorShell = _procgen.getRandomActorWeighted(min, max);
        if (actorShell) {
            return _creator.createFromShell(RG.TYPE_ACTOR, actorShell);
        }
        else if (!RG.isNullOrUndef([obj])) {
            return this.createRandomActor(obj);
        }
        return null;
    };

    /* Creates a random item based on a selection function.
     *
     * Example:
     *  const funcValueSel = function(item) {return item.value >= 100;}
     *  const item = createRandomItem({func: funcValueSel});
     *  // Above returns item with value > 100.
     *  */
    this.createRandomItem = obj => {
        const randShell = _procgen.getRandomItem(obj);
        if (randShell) {
            return _creator.createFromShell('items', randShell);
        }
        return null;
    };


};

module.exports = RG.ObjectShell;
