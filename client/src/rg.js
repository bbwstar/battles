
const ROT = require('../../lib/rot.js');

const $DEBUG = 0;

/* Main object of the package for encapsulating all other objects. */
const RG = { // {{{2

    gameTitle: 'Battles in the North (BitN)',

    // Can be set to true for testing, when error conditions are checked
    suppressErrorMessages: false,

    cellRenderVisible: ['actors', 'items', 'traps', 'elements'],
    cellRenderAlways: ['items', 'traps', 'elements'],

    /* Given Map.Cell, returns CSS classname used for styling that cell. */
    getClassName: function(cell, isVisible) {
        if (isVisible) {this.cellRenderArray = this.cellRenderVisible;}
        else {this.cellRenderArray = this.cellRenderAlways;}
        const className = this.getStyleClassForCell(cell);
        this.cellRenderArray = this.cellRenderVisible;
        return className;
    },

    /* Same as getClassName, but optimized for viewing the full map. */
    getClassNameFullMap: function(cell) {
        this.cellRenderArray = this.cellRenderVisible;

        if (!cell.hasProps()) {
            const baseType = cell.getBaseElem().getType();
            return this.cellStyles.elements[baseType];
        }

        for (let i = 0; i < 4; i++) {
            const propType = this.cellRenderVisible[i];
            if (cell.hasProp(propType)) {
                const props = cell.getProp(propType);
                const styles = this.cellStyles[propType];
                return this.getPropClassOrCharFullMap(styles, props[0]);
            }
        }
        return null;
    },

    /* Given Map.Cell, returns a char that is rendered for the cell. */
    getChar: function(cell, isVisible) {
        if (isVisible) {this.cellRenderArray = this.cellRenderVisible;}
        else {this.cellRenderArray = this.cellRenderAlways;}
        const cellChar = this.getCellChar(cell);
        this.cellRenderArray = this.cellRenderVisible;
        return cellChar;
    },

    /* Same as getChar, but optimized for full map viewing. */
    getCharFullMap: function(cell) {
        this.cellRenderArray = this.cellRenderVisible;

        if (!cell.hasProps()) {
            const baseType = cell.getBaseElem().getType();
            return this.charStyles.elements[baseType];
        }

        for (let i = 0; i < 4; i++) {
            if (cell.hasProp(this.cellRenderVisible[i])) {
                const props = cell.getProp(this.cellRenderVisible[i]);
                const styles = this.charStyles[this.cellRenderVisible[i]];
                return this.getPropClassOrCharFullMap(styles, props[0]);
            }
        }
        return null;
    },

    /* Maps a cell to specific object in stylesheet. For rendering purposes
     * only.*/
    getStyleClassForCell: function(cell) {
        if (!cell.isExplored()) { return 'cell-not-explored';}

        for (let i = 0; i < this.cellRenderArray.length; i++) {
            const propType = this.cellRenderArray[i];
            if (cell.hasProp(propType)) {
                const props = cell.getProp(propType);
                const styles = this.cellStyles[propType];
                const propObj = props[0];
                return this.getPropClassOrChar(styles, propObj);
            }
        }

        const baseType = cell.getBaseElem().getType();
        return this.cellStyles.elements[baseType];
    },

    getPropClassOrChar: function(styles, propObj) {
        const objType = propObj.getType();

        // Return by name, this is for object shells generally
        if (propObj.getName) {
            const name = propObj.getName();
            if (styles.hasOwnProperty(name)) {
                return styles[name];
            }
        }

        // By type is usually for basic elements
        if (styles.hasOwnProperty(objType)) {
            if (typeof styles[objType] === 'object') {
                // Invoke a state querying function
                for (const p in styles[objType]) {
                    if (p !== 'default') {
                        const funcToCall = p;
                        if (propObj[funcToCall]()) {
                            return styles[objType][p];
                        }
                    }
                }
                return styles[objType]['default'];

            }
            return styles[objType];
        }
        else {
            return styles['default'];
        }
    },

    getPropClassOrCharFullMap: function(styles, propObj) {
        // Return by name, this is for object shells generally
        if (propObj.getName) {
            const name = propObj.getName();
            if (styles.hasOwnProperty(name)) {
                return styles[name];
            }
        }

        const objType = propObj.getType();
        // By type is usually for basic elements
        if (styles.hasOwnProperty(objType)) {
            if (typeof styles[objType] === 'object') {
                // Invoke a state querying function
                for (const p in styles[objType]) {
                    if (p !== 'default') {
                        const funcToCall = p;
                        if (propObj[funcToCall]()) {
                            return styles[objType][p];
                        }
                    }
                }
                return styles[objType]['default'];

            }
            return styles[objType];
        }
        else {
            return styles['default'];
        }
    },

    /* Returns char which is rendered on the map cell based on cell contents.*/
    getCellChar: function(cell) {
        if (!cell.isExplored()) {return 'X';}

        for (let i = 0; i < this.cellRenderArray.length; i++) {
            // const propType = this.cellRenderArray[i];
            if (cell.hasProp(this.cellRenderArray[i])) {
                const props = cell.getProp(this.cellRenderArray[i]);
                const styles = this.charStyles[this.cellRenderArray[i]];
                const propObj = props[0];
                return this.getPropClassOrChar(styles, propObj);
            }
        }

        const baseType = cell.getBaseElem().getType();
        return this.charStyles.elements[baseType];
    },

    getShortestPassablePath: function(map, x0, y0, x1, y1) {
        const coords = [];
        const passableCallback = (x, y) => map.isPassable(x, y);
        const finder = new ROT.Path.AStar(x1, y1, passableCallback);
        finder.compute(x0, y0, (x, y) => {
            coords.push({x, y});
        });
        return coords;
    },

    /* Returns shortest path (array of x,y pairs) between two points. Does not
    * check if any of the cells are passable. */
    getShortestPath: function(x0, y0, x1, y1) {
        const coords = [];
        const passableCallback = () => true;
        // const finder = new ROT.Path.Dijkstra(x1, y1, passableCallback);
        const finder = new ROT.Path.AStar(x1, y1, passableCallback);
        finder.compute(x0, y0, (x, y) => {
            coords.push({x, y});
        });
        return coords;
    },

    /* Returns shortest distance (in cells) between two points.*/
    shortestDist: function(x0, y0, x1, y1) {
        const coords = this.getShortestPath(x0, y0, x1, y1);
        return coords.length - 1; // Subtract one because starting cell included
    },

    /* Adds a CSS class for given prop and type. For example, "actors", "wolf",
     * "cell-actor-wolf" uses CSS class .cell-actor-wolf to style cells with
     * wolves in them. */
    addCellStyle: function(prop, type, className) {
        if (this.cellStyles.hasOwnProperty(prop)) {
            this.cellStyles[prop][type] = className;
        }
        else {
            this.err('RG', 'addCellStyle', 'Unknown prop type: ' + prop);
        }
    },

    /* Adds a char to render for given prop and type. Example: "actors",
     * "wolf", "w" renders 'w' for cells containing wolves.*/
    addCharStyle: function(prop, type, charName) {
        if (this.charStyles.hasOwnProperty(prop)) {
            this.charStyles[prop][type] = charName;
        }
        else {
            this.err('RG', 'addCharStyle', 'Unknown prop type: ' + prop);
        }
    },

    // These are used to select rendered characters for map cells.
    charStyles: {
        elements: {
            bridge: '=',
            chasm: '~',
            default: '.',
            floor: '.',
            floorcave: '.',
            floorcrypt: '.',
            fort: '#',
            grass: '"',
            highrock: '^',
            passage: '.',
            road: '.',
            shop: ':',
            snow: '.',
            stairsDown: '>',
            stairsUp: '<',
            stone: '^',
            tree: 'T',
            wall: '#',
            wallcave: '#',
            wallcrypt: '#',
            wallice: '#',
            wallwooden: '#',
            water: '~',
            // Elements with different states
            door: {
                isClosed: '+', // if isClosed() returns true
                default: '/'
            }
        },
        actors: {
            default: 'X',
            monster: '@',
            player: '@',
            spirit: 'Q',
            summoner: 'Z',
            wolf: 'w'
        },
        items: {
            default: '?',
            corpse: '§',
            potion: '!',
            spiritgem: '*'
        },
        traps: {}
    },

    // These are used to select the CSS class for map cells.
    cellStyles: {
        elements: {
            bridge: 'cell-element-bridge',
            chasm: 'cell-element-chasm',
            default: 'cell-element-default',
            door: 'cell-element-door',
            floor: 'cell-element-floor',
            floorcave: 'cell-element-floor-cave',
            floorcrypt: 'cell-element-floor-crypt',
            fort: 'cell-element-fort',
            grass: 'cell-element-grass',
            highrock: 'cell-element-highrock',
            passage: 'cell-element-passage',
            road: 'cell-element-road',
            shop: 'cell-element-shop',
            snow: 'cell-element-snow',
            stone: 'cell-element-stone',
            tree: 'cell-element-tree',
            wall: 'cell-element-wall',
            wallcave: 'cell-element-wall-cave',
            wallcrypt: 'cell-element-wall-crypt',
            wallice: 'cell-element-wall-ice',
            wallwooden: 'cell-element-wall-wooden',
            water: 'cell-element-water'
        },
        actors: {
            default: 'cell-actor-default',
            player: 'cell-actor-player',
            monster: 'cell-actor-monster',
            summoner: 'cell-actor-summoner',
            wolf: 'cell-actor-animal',
            spirit: 'cell-actor-spirit'
        },
        items: {
            potion: 'cell-item-potion',
            spiritgem: 'cell-item-spiritgem',
            default: 'cell-item-default'
        },
        traps: {
            default: 'cell-traps'
        }
    },

    debug: function(obj, msg) {
        if ($DEBUG) {
            const inst = typeof obj;
            const json = JSON.stringify(obj);
            console.log(`[DEBUG]: Type: ${inst} ${json} |${msg}|`);
        }
    },

    err: function(obj, fun, msg) {
        if (!this.suppressErrorMessages) {
            const formattedMsg = `[ERROR]: ${obj} ${fun} -> |${msg}|`;
            console.error(formattedMsg);
            throw new Error(formattedMsg);
        }
    },

    warn: function(obj, fun, msg) {
        if (!this.suppressWarningMessages) {
            const formattedMsg = `[WARN]: ${obj} ${fun} -> |${msg}|`;
            console.error(formattedMsg);
        }
    },


    /* Used to inherit from a prototype. Supports multiple inheritance but
     * sacrifices instanceof.*/
    extend2: function(Child, Parent) {
        const p = Parent.prototype;
        const c = Child.prototype;
        for (const i in p) {
            if (!c.hasOwnProperty(i)) {
                c[i] = p[i];
            }
        }
        if (c.hasOwnProperty('uber')) {
            const ubers = [c.uber];
            ubers.push(p);
            c.uber = ubers;
        }
        else {
            c.uber = [];
            c.uber.push(p);
        }
    },

    /* Prints an error into console if 'val' is null or undefined.*/
    nullOrUndefError: function(name, msg, val) {
        if (this.isNullOrUndef([val])) {
            const formattedMsg = `nullOrUndef ${name} ${msg}`;
            console.error(formattedMsg);
            throw new Error(formattedMsg);
        }
    },

    /* Returns true if anything in the list is null or undefined.*/
    isNullOrUndef: function(list) {
        for (let i = 0; i < list.length; i++) {
            if (list[i] === null || typeof list[i] === 'undefined' ||
                typeof list === 'undefined') {
                return true;
            }
        }
        return false;
    },

    // -------------------------------------------------
    // Functions for emitting in-game messages to player
    // -------------------------------------------------

    // Accepts 2 different arguments:
    // 1. A simple string messages
    // 2. {msg: "Your message", cell: Origin cell of messaage}
    // Using 2. messages can be easily filtered by position.
    gameMsg: function(msg) {
        this.emitMsgEvent('prim', msg);
    },

    gameInfo: function(msg) {
        this.emitMsgEvent('info', msg);
    },

    gameDescr: function(msg) {
        this.emitMsgEvent('descr', msg);
    },

    gameSuccess: function(msg) {
        this.emitMsgEvent('success', msg);
    },

    gameWarn: function(msg) {
        this.emitMsgEvent('warn', msg);
    },

    gameDanger: function(msg) {
        this.emitMsgEvent('danger', msg);
    },

    /* Emits message event with cell origin, style and message. */
    emitMsgEvent: function(style, msg) {
        let newMsg = '';
        if (typeof msg === 'object') {
            const cell = msg.cell;
            newMsg = msg.msg;
            newMsg = newMsg[0].toUpperCase() + newMsg.substring(1);

            const msgObject = {cell, msg: newMsg, style};
            this.POOL.emitEvent(this.EVT_MSG, msgObject);
        }
        else {
            newMsg = msg[0].toUpperCase() + msg.substring(1);
            this.POOL.emitEvent(this.EVT_MSG, {msg: newMsg, style});
        }

    },

    /* Tries to add item2 to item1 stack. Returns true on success.*/
    addStackedItems: function(item1, item2) {
        if (item1.equals(item2)) {
            let countToAdd = 1;
            if (item2.count) {
                countToAdd = item2.count;
            }

            // Check if item1 already stacked
            if (item1.count) {
                item1.count += countToAdd;
            }
            else {
                item1.count = 1 + countToAdd;
            }
            return true;
        }
        return false;
    },

    /* Removes N items from the stack and returns them. Returns null if the
     * stack is not changed.*/
    removeStackedItems: function(itemStack, n) {
        if (n > 0) {
            let rmvItem = null;
            if (itemStack.count) {
                if (n <= itemStack.count) {
                    itemStack.count -= n;
                    rmvItem = itemStack.clone();
                    rmvItem.count = n;
                    return rmvItem;
                }
                else {
                    rmvItem = itemStack.clone();
                    rmvItem.count = itemStack.count;
                    itemStack.count = 0;
                    return rmvItem;
                }
            }
            else { // Remove all
                itemStack.count = 0;
                rmvItem = itemStack.clone();
                rmvItem.count = 1;
                return rmvItem;
            }
        }
        return null;
    },

    //--------------------------------------------------------------
    // COMBAT-RELATED FUNCTIONS
    //--------------------------------------------------------------

    getMeleeAttack: function(att) {
        let attack = att.getAttack();
        const missile = att.getInvEq().getEquipment().getItem('missile');
        const missWeapon = att.getInvEq().getMissileWeapon();
        if (missile) {attack -= missile.getAttack();}
        if (missWeapon) {attack -= missWeapon.getAttack();}
        return attack;
    },


    getMissileDamage: function(att, miss) {
        let dmg = miss.rollDamage();
        dmg += Math.round(att.get('Stats').getAgility() / 3);
        if (miss.has('Ammo')) {
            dmg += att.getMissileWeapon().rollDamage();
        }
        return dmg;
    },

    getMissileAttack: function(att) {
        let attack = att.get('Combat').getAttack();
        attack += att.getInvEq().getEquipment().getAttack();
        attack += att.get('Stats').getAccuracy() / 2;
        attack += att.getInvEq().getEquipment().getAccuracy() / 2;

        // Subtract melee weapon
        const weapon = att.getWeapon();
        if (weapon) {attack -= weapon.getAttack();}

        return attack;
    },

    getMissileRange: function(att, miss) {
        let range = miss.getAttackRange();
        if (miss.has('Ammo')) {
            const missWeapon = att.getMissileWeapon();
            const weaponRange = missWeapon.getAttackRange();
            range += weaponRange;
        }
        return range;
    },

    /* Given actor and cells it sees, returns first enemy cell found.*/
    findEnemyCellForPlayer: function(actor, seenCells) {
        const res = [];
        for (let i = 0; i < seenCells.length; i++) {
            if (seenCells[i].hasActors()) {
                const actors = seenCells[i].getProp('actors');
                for (let j = 0; j < actors.length; j++) {
                    if (actor !== actors[j]) {
                        if (actors[j].isEnemy(actor)) {
                            res.push(seenCells[i]);
                        }
                    }
                }
            }
        }
        return res;
    },

    strengthToDamage: function(str) {
        return Math.round(str / 4);
    },

    // Event pool -related stuff

    eventPools: [],
    POOL: null,

    resetEventPools: function() {
        this.eventPools = [];
        this.POOL = null;
    },

    // Event pool controls
    pushEventPool: function(pool) {
        this.eventPools.push(pool);
        this.POOL = pool;
    },

    popEventPool: function() {
        this.eventPools.pop();
        const nlen = this.eventPools.length;
        if (nlen > 0) {
            this.POOL = this.eventPools[nlen - 1];
        }
        else {
            RG.err('RG', 'popEventPool', 'No event pools left.');
        }
    },

    //--------------------------------------------------------------
    // CONSTANTS
    //--------------------------------------------------------------

    // Default FOV range for actors
    FOV_RANGE: 4,
    ACTION_DUR: 100,
    BASE_SPEED: 100,
    DEFAULT_HP: 50,

    // How many levels are simulated at once, having more adds realism
    // but slows down the game
    MAX_ACTIVE_LEVELS: 3,

    //----------------------
    // Different game events
    //----------------------
    EVT_ACTOR_CREATED: Symbol(),
    EVT_ACTOR_KILLED: Symbol(),
    EVT_DESTROY_ITEM: Symbol(),
    EVT_MSG: Symbol(),

    EVT_LEVEL_CHANGED: Symbol(),
    EVT_LEVEL_ENTERED: Symbol(),

    EVT_LEVEL_PROP_ADDED: Symbol(),
    EVT_LEVEL_PROP_REMOVED: Symbol(),

    EVT_ACT_COMP_ADDED: Symbol(),
    EVT_ACT_COMP_REMOVED: Symbol(),
    EVT_ACT_COMP_ENABLED: Symbol(),
    EVT_ACT_COMP_DISABLED: Symbol(),

    EVT_WIN_COND_TRUE: Symbol(),

    EVT_ANIMATION: Symbol(),

    //----------------------------
    // Different entity/prop types
    //----------------------------
    TYPE_ACTOR: 'actors',
    TYPE_ELEM: 'elements',
    TYPE_ITEM: 'items',
    TYPE_TRAP: 'traps',

    ITEM_TYPES: ['ammo', 'armour', 'food', 'gold', 'goldcoin',
        'missile', 'missileweapon', 'potion', 'spiritgem', 'weapon'],

    LEVEL_ID_ADD: 1000000000,
    ENTITY_ID_ADD: 1000000000,

    //----------------------------
    // Different level types
    //----------------------------

    LEVEL_EMPTY: 'empty',
    LEVEL_FOREST: 'forest',
    LEVEL_MOUNTAIN: 'mountain',

    // Energy per action
    energy: {
        DEFAULT: 5,
        REST: 5,
        USE: 5,
        PICKUP: 5,
        MISSILE: 10,
        MOVE: 10,
        ATTACK: 15,
        RUN: 20
    },

    // Different fighting modes
    FMODE_NORMAL: 0,
    FMODE_FAST: 1,
    FMODE_SLOW: 2,

    // 0.0 = uniform dist, higher number assigns more weight to median values
    DANGER_ADJ_FACTOR: 1.4,

    GOLD_COIN_WEIGHT: 0.03, // kg
    GOLD_COIN_NAME: 'Gold coins',

    HUNGER_PROB: 0.10, // Prob. of starvation to cause damage every turn
    HUNGER_DMG: 1,     // Damage caused by starvation kicking in

    // This is a subset of ITEM_TYPES, excluding gold items
    SHOP_TYPES: ['ammo', 'armour', 'food',
        'missile', 'missileweapon', 'potion', 'spiritgem', 'weapon'
    ],

    // Alignments (TODO make more diverse)
    ALIGN_GOOD: 'ALIGN_GOOD',
    ALIGN_EVIL: 'ALIGN_EVIL',
    ALIGN_NEUTRAL: 'ALIGN_NEUTRAL',

    // Constants for movement directions
    DIR: {
        N: [0, -1],
        S: [0, 1],
        E: [1, 0],
        W: [-1, 0],
        NE: [1, -1],
        SE: [1, 1],
        NW: [-1, -1],
        SW: [1, -1]
    },

    DMG: {
        MELEE: 'MELEE',
        MISSILE: 'MISSILE',
        POISON: 'POISON',
        ICE: 'ICE',
        HUNGER: 'HUNGER'
    }

}; // / }}} RG


RG.cellRenderArray = RG.cellRenderVisible;

RG.PROP_TYPES = [RG.TYPE_ACTOR, RG.TYPE_ELEM, RG.TYPE_ITEM, RG.TYPE_TRAP];
// Fighting modes
RG.FMODES = [RG.FMODE_NORMAL, RG.FMODE_FAST, RG.FMODE_SLOW];

RG.ALIGNMENTS = [RG.ALIGN_GOOD, RG.ALIGN_NEUTRAL, RG.ALIGN_EVIL];

RG.cellRenderArray = RG.cellRenderVisible;

/* Returns danger probabilites for given level.*/
RG.getDangerProb = (min, max) => {
    if (min > max) {
        console.error('RG.getDangerProb param order is min < max');
        return {};
    }
    const level = max + 1;
    const arr = [];
    for (let j = min; j <= level; j++) {
        arr.push(j);
    }

    const last = arr.length - 1;
    const maxArr = arr[last];

    const highPoint = (maxArr % 2 === 0) ? maxArr / 2 : (maxArr + 1) / 2;
    const obj = {};

    arr.forEach( val => {
        const absDiff = Math.abs(val - highPoint);
        let prob = maxArr - Math.floor(RG.DANGER_ADJ_FACTOR * absDiff);
        prob = (prob === 0) ? prob + 1 : prob;
        obj[val] = prob;

    });

    return obj;
};

/* Returns the weight distribution for foods. This is something like
 * {0.1: 10, 0.2: 7, 0.3: 5, 0.5: 1} etc.*/
RG.getFoodWeightDistr = () => ({
    0.1: 20,
    0.2: 10,
    0.3: 5,
    0.4: 3,
    0.5: 1
});

/* Returns the count distribution for gold coins. */
RG.getGoldCoinCountDistr = nLevel => {
    const maxVal = nLevel + 1;
    const dist = {};
    for (let i = 1; i <= maxVal; i++) {
        dist[i] = nLevel;
    }
    return dist;
};

/* Converts abstract value into gold weight. */
RG.valueToGoldWeight = value => {
    let currVal = value;
    let slope = 1;
    while (currVal >= 100) {
        currVal -= 100;
        ++slope;
    }
    const adjValue = slope * value + 10;
    return adjValue / 1000;
};

/* Given an actor, scales its attributes based on new experience level.*/
RG.levelUpActor = (actor, newLevel) => {
    if (actor.has('Experience')) {
        let currLevel = actor.get('Experience').getExpLevel();
        if (currLevel < newLevel) {
            while (currLevel < newLevel) {
                const nextLevel = currLevel + 1;

                // Level up the Combat component
                if (actor.has('Combat')) {
                    const combatComp = actor.get('Combat');
                    combatComp.setAttack(combatComp.getAttack() + 1);
                    combatComp.setDefense(combatComp.getDefense() + 1);
                    if (nextLevel % 3 === 0) {
                        const prot = combatComp.getProtection();
                        combatComp.setProtection(prot + 1);
                    }

                    // Upgrade damage die was well
                    const dmgDie = combatComp.getDamageDie();
                    dmgDie.setDice( dmgDie.getDice() + 1);
                    if (nextLevel % 3 === 0) {
                        dmgDie.setMod( dmgDie.getMod() + 1);
                    }
                }

                // Level up the Health
                if (actor.has('Health')) {
                    const hComp = actor.get('Health');
                    let incr = 2;
                    if (actor.isPlayer()) {incr = 5;}
                    hComp.setMaxHP(hComp.getMaxHP() + incr);
                    hComp.setHP(hComp.getHP() + incr);
                }
                ++currLevel;

            }
            actor.get('Experience').setExpLevel(newLevel);
        }
        else {
            RG.err('RG', 'levelUpActor', 'New level must be > current level.');
        }
    }
    else {
        RG.err('RG', 'levelUpActor', 'No exp. component found.');

    }
};

// Regexp for parsing dice expressions '2d4' or '1d6 + 1' etc.
RG.DIE_RE = /\s*(\d+)d(\d+)\s*(\+|-)?\s*(\d+)?/;

/* Parses die expression like '2d4' or '3d5 + 4' and returns it as an array [2,
 * 4, 0] or [3, 5, 4]. Returns empty array for invalid expressions.*/
RG.parseDieSpec = strOrArray => {
    if (typeof strOrArray === 'object') {
        if (strOrArray.length >= 3) {
            return [strOrArray[0], strOrArray[1], strOrArray[2]];
        }
    }
    else {
        const match = RG.DIE_RE.exec(strOrArray);
        if (match !== null) {
            const num = match[1];
            const dType = match[2];
            let mod = null;
            if (!RG.isNullOrUndef([match[3], match[4]])) {
                if (match[3] === '+') {mod = match[4];}
                else {mod = -match[4];}
            }
            else {
                mod = 0;
            }
            return [num, dType, mod];
        }
        else {
            RG.err('RG', 'parseDieSpec', 'Cannot parse: ' + strOrArray);
        }
    }
    return [];
};

RG.ONE_SHOT_ITEMS = ['potion'];

/* Returns true if given item is one-shot use item by its type.*/
RG.isOneShotItem = item => {
    const itemType = item.getType();
    const index = RG.ONE_SHOT_ITEMS.indexOf(itemType);
    return index >= 0;
};

/* Destroys item (typically after use). */
RG.destroyItemIfNeeded = item => {
    if (RG.isOneShotItem(item)) {
        if (item.count === 1) {
            const msg = {item: item};
            RG.POOL.emitEvent(RG.EVT_DESTROY_ITEM, msg);
        }
        else {
            item.count -= 1;
        }
    }
};

/* Given gold weight, returns the equivalent in coins.*/
RG.getGoldInCoins = weight => Math.floor(weight / RG.GOLD_COIN_WEIGHT);

/* eslint-disable */
RG.VK_a = ROT.VK_A + 32;
RG.VK_b = ROT.VK_B + 32;
RG.VK_c = ROT.VK_C + 32;
RG.VK_d = ROT.VK_D + 32;
RG.VK_e = ROT.VK_E + 32;
RG.VK_f = ROT.VK_F + 32;
RG.VK_g = ROT.VK_G + 32;
RG.VK_h = ROT.VK_H + 32;
RG.VK_i = ROT.VK_I + 32;
RG.VK_j = ROT.VK_J + 32;
RG.VK_k = ROT.VK_K + 32;
RG.VK_l = ROT.VK_L + 32;
RG.VK_m = ROT.VK_M + 32;
RG.VK_n = ROT.VK_N + 32;
RG.VK_o = ROT.VK_O + 32;
RG.VK_p = ROT.VK_P + 32;
RG.VK_q = ROT.VK_Q + 32;
RG.VK_r = ROT.VK_R + 32;
RG.VK_s = ROT.VK_S + 32;
RG.VK_t = ROT.VK_T + 32;
RG.VK_u = ROT.VK_U + 32;
RG.VK_v = ROT.VK_V + 32;
RG.VK_w = ROT.VK_W + 32;
RG.VK_x = ROT.VK_X + 32;
RG.VK_y = ROT.VK_Y + 32;
RG.VK_z = ROT.VK_Z + 32;
/* eslint-enable */

RG.VK_COMMA = 44;
RG.VK_PERIOD = 46;
RG.VK_LT = 60;
RG.VK_GT = 62;

/* Lookup table object for movement and actions keys.*/
RG.KeyMap = {

    moveKeyMap: { },

    // Start from W, go clock wise on keyboard
    initMap: function() {
        this.moveKeyMap[RG.KEY.MOVE_N] = 0;
        this.moveKeyMap[RG.KEY.MOVE_NE] = 1;
        this.moveKeyMap[RG.KEY.MOVE_E] = 2;
        this.moveKeyMap[RG.KEY.MOVE_SE] = 3;
        this.moveKeyMap[RG.KEY.MOVE_S] = 4;
        this.moveKeyMap[RG.KEY.MOVE_SW] = 5;
        this.moveKeyMap[RG.KEY.MOVE_W] = 6;
        this.moveKeyMap[RG.KEY.MOVE_NW] = 7;

        this.moveKeyMap[ROT.VK_8] = 0;
        this.moveKeyMap[ROT.VK_9] = 1;
        this.moveKeyMap[ROT.VK_6] = 2;
        this.moveKeyMap[ROT.VK_3] = 3;
        this.moveKeyMap[ROT.VK_2] = 4;
        this.moveKeyMap[ROT.VK_1] = 5;
        this.moveKeyMap[ROT.VK_4] = 6;
        this.moveKeyMap[ROT.VK_7] = 7;
    },

    inMoveCodeMap: function(code) {
        return this.moveKeyMap.hasOwnProperty(code);
    },

    isRest: function(code) {return code === RG.VK_s || code === RG.VK_PERIOD;},
    isPickup: function(code) {return code === RG.KEY.PICKUP;},
    isUseStairs: function(code) {
        return code === RG.KEY.USE_STAIRS_DOWN ||
            code === RG.KEY.USE_STAIRS_UP;
    },
    isRunMode: function(code) {return code === RG.KEY.RUN;},
    isFightMode: function(code) {return code === RG.KEY.FIGHT;},
    isConfirmYes: function(code) {return code === RG.KEY.YES;},
    isNextItem: function(code) {return code === RG.KEY.NEXT_ITEM;},
    isToggleDoor: function(code) {return code === RG.KEY.DOOR;},
    isLook: function(code) {return code === RG.KEY.LOOK;},
    isUsePower: function(code) {return code === RG.KEY.POWER;},
    isTargetMode: function(code) {return code === RG.KEY.TARGET;},
    isNextTarget: function(code) {return code === RG.KEY.NEXT;},

    /* Based on keycode, computes and returns a new x,y pair. If code is
     * invalid, returns null. */
    getDiff: function(code, x, y) {
        if (this.moveKeyMap.hasOwnProperty(code)) {
            const diff = ROT.DIRS[8][this.moveKeyMap[code]];
            const newX = x + diff[0];
            const newY = y + diff[1];
            return [newX, newY];
        }
        else if (code === RG.VK_s) {
            return [x, y];
        }
        else {
            return null;
        }
    },

    getDir: function(code) {
        if (this.moveKeyMap.hasOwnProperty(code)) {
            return ROT.DIRS[8][this.moveKeyMap[code]];
        }
        else if (this.isRest(code)) {
            return [0, 0];
        }
        return null;
    }

};

RG.menuIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 'a', 'b', 'c', 'd', 'e', 'f',
    'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
    'u', 'v', 'w', 'x', 'y', 'z'
];

RG.codeToIndex = code => {
    if (code >= ROT.VK_0 && code <= ROT.VK_9) {
        return code - ROT.VK_0;
    }
    else if (code >= RG.VK_a && code <= RG.VK_z) {
        return code - RG.VK_a + 10;
    }
    return -1;
};

RG.KEY = {};

// Assign ROT keys to meaningful constants
RG.KEY.MOVE_N = ROT.VK_W + 32;
RG.KEY.MOVE_NE = ROT.VK_E + 32;
RG.KEY.MOVE_E = ROT.VK_D + 32;
RG.KEY.MOVE_SE = ROT.VK_C + 32;
RG.KEY.MOVE_S = ROT.VK_X + 32;
RG.KEY.MOVE_SW = ROT.VK_Z + 32;
RG.KEY.MOVE_W = ROT.VK_A + 32;
RG.KEY.MOVE_NW = ROT.VK_Q + 32;

RG.KEY.PICKUP = RG.VK_COMMA;
RG.KEY.USE_STAIRS_UP = RG.VK_LT;
RG.KEY.USE_STAIRS_DOWN = RG.VK_GT;
RG.KEY.RUN = ROT.VK_R + 32;
RG.KEY.FIGHT = ROT.VK_F + 32;
RG.KEY.YES = ROT.VK_Y + 32;
RG.KEY.NEXT_ITEM = ROT.VK_H + 32;
RG.KEY.DOOR = ROT.VK_O + 32;
RG.KEY.REST = ROT.VK_S + 32;
RG.KEY.LOOK = ROT.VK_L + 32;
RG.KEY.POWER = ROT.VK_P + 32;
RG.KEY.TARGET = RG.VK_t;
RG.KEY.NEXT = RG.VK_n;
RG.KeyMap.initMap();

RG.isValidKey = keyCode => {
    let found = false;
    Object.keys(RG.KEY).forEach(key => {
        found = found || RG.KEY[key] === keyCode;
    });
    found = found || RG.KeyMap.inMoveCodeMap(keyCode);
    return found;
};

// These determine the size of one block in a level. These numbers are important
// because they determine a sub-area used for procedural generation of shops,
// vaults and other special features.
RG.BLOCK_X = 20;
RG.BLOCK_Y = 7;

// Level size determined as function of BLOCK_X/Y. Note that due to different
// block size or x/y, levels are not square shaped, but x > y.
RG.LEVEL_SMALL_X = 3 * RG.BLOCK_X;
RG.LEVEL_SMALL_Y = 3 * RG.BLOCK_Y;
RG.LEVEL_MEDIUM_X = 4 * RG.BLOCK_X;
RG.LEVEL_MEDIUM_Y = 4 * RG.BLOCK_Y;
RG.LEVEL_LARGE_X = 5 * RG.BLOCK_X;
RG.LEVEL_LARGE_Y = 5 * RG.BLOCK_Y;
RG.LEVEL_HUGE_X = 7 * RG.BLOCK_X;
RG.LEVEL_HUGE_Y = 7 * RG.BLOCK_Y;

// Controls the number of items generated for each N squares
RG.LOOT_SPARSE_SQR = 200;
RG.LOOT_MEDIUM_SQR = 120;
RG.LOOT_ABUNDANT_SQR = 50;

// Controls the number of actors generated for each N squares
RG.ACTOR_SPARSE_SQR = 200;
RG.ACTOR_MEDIUM_SQR = 120;
RG.ACTOR_ABUNDANT_SQR = 50;

RG.getCardinalDirection = (level, cell) => {
    const cols = level.getMap().cols;
    const rows = level.getMap().rows;
    const x = cell.getX();
    const y = cell.getY();
    if (y === 0) {return 'north';}
    if (y === rows - 1) {return 'south';}
    if (x === cols - 1) {return 'east';}
    if (x === 0) {return 'west';}
    return 'somewhere';
};

/* Debugging function for printing 2D map row-by-row. */
RG.printMap = map => {
    let rowByRow = null;
    if (Array.isArray(map)) {
        rowByRow = RG.colsToRows(map);
    }
    else if (map instanceof RG.Map.CellList) {
        rowByRow = RG.colsToRows(map._map);
    }
    if (rowByRow) {
        const sizeY = rowByRow.length;
        for (let y = 0; y < sizeY; y++) {
            console.log(rowByRow[y].join(''));
        }
    }

};

RG.colsToRows = arr => {
    const res = [];
    const sizeY = arr[0].length;
    const sizeX = arr.length;
    for (let y = 0; y < sizeY; y++) {
        res[y] = [];
        for (let x = 0; x < sizeX; x++) {
            res[y][x] = arr[x][y];
        }
    }
    return res;
};

/* Given 2D array of elements, flattens all arrays inside each [x][y]
 * positions. */
RG.flattenTo2D = arr => {
    const sizeY = arr.length;
    const res = [];
    for (let y = 0; y < sizeY; y++) {
        let row = arr[y];
        row = flat(row);
        res.push(row);
    }
	function flat(data) {
		var r = [];
        data.forEach(e => {
            if (Array.isArray(e)) {
                r = r.concat(flat(e));
            }
            else {
                r.push(e);
            }
        });
		return r;
	}
	return res;
};

RG.setAllExplored = (level, isExplored) => {
    const map = level.getMap();
    for (let x = 0; x < map.cols; x++) {
        for (let y = 0; y < map.rows; y++) {
            const cell = map._map[x][y];
            cell.setExplored(isExplored);
        }
    }
};

RG.addCompToEntAfterHit = (comp, ent) => {
    const compClone = comp.clone();

    if (comp.hasOwnProperty('duration')) {
        const compDur = compClone.rollDuration();
        const expiration = new RG.Component.Expiration();
        expiration.addEffect(compClone, compDur);
        ent.add('Expiration', expiration);
    }

    ent.add(compClone.getType(), compClone);
};

/* Returns a game message for cell which cannot be travelled. */
RG.getImpassableMsg = (actor, cell, str) => {
    const type = cell.getBaseElem().getType();
    const cellMsg = `cannot venture beyond ${type}`;
    return `${str} ${cellMsg}`;
};

/* Each die has number of throws, type of dice (d6, d20, d200...) and modifier
 * which is +/- X. */
RG.Die = function(num, dice, mod) {
    let _num = parseInt(num, 10);
    let _dice = parseInt(dice, 10);
    let _mod = parseInt(mod, 10);

    this.getNum = () => _num;
    this.setNum = num => {_num = num;};
    this.getDice = () => _dice;
    this.setDice = dice => {_dice = dice;};
    this.getMod = () => _mod;
    this.setMod = mod => {_mod = mod;};

    this.roll = () => {
        let res = 0;
        for (let i = 0; i < _num; i++) {
            res += RG.RAND.getUniformInt(1, _dice);
        }
        return res + _mod;
    };

    this.toString = () => {
        let sign = '+';
        if (mod < 0) {sign = '-';}
        return _num + 'd' + _dice + ' ' + sign + ' ' + _mod;
    };

    this.copy = rhs => {
        _num = rhs.getNum();
        _dice = rhs.getDice();
        _mod = rhs.getMod();
    };

    /* Returns true if dice are equal.*/
    this.equals = rhs => {
        let res = _num === rhs.getNum();
        res = res && (_dice === rhs.getDice());
        res = res && (_mod === rhs.getMod());
        return res;
    };

    this.toJSON = () => [_num, _dice, _mod];
};

/* Event pool can be used to emit events and register callbacks for listeners.
 * This decouples the emitter and listener from each other.  */
RG.EventPool = function() { // {{{2
    const _listeners = {};
    let _eventsNoListener = 0;

    this.getNumListeners = () => _eventsNoListener;

    /* Emits an event with given name. args must be in object-notation ie.
     * {data: "abcd"} */
    this.emitEvent = (evtName, args) => {
        if (!RG.isNullOrUndef([evtName])) {
            if (_listeners.hasOwnProperty(evtName)) {
                const called = _listeners[evtName];
                for (let i = 0; i < called.length; i++) {
                    called[i].notify(evtName, args);
                }
            }
            else {
                ++_eventsNoListener;
            }
        }
        else {
            RG.nullOrUndefError('EventPool: emitEvent',
                'Event name must be given.', evtName);
        }
    };

    /* Register an event listener. */
    this.listenEvent = (evtName, obj) => {
        if (!RG.isNullOrUndef([evtName])) {
            if (obj.hasOwnProperty('notify') || obj.hasNotify) {
                if (_listeners.hasOwnProperty(evtName)) {
                    const index = _listeners[evtName].indexOf(obj);
                    if (index === -1) {
                        _listeners[evtName].push(obj);
                    }
                }
                else {
                    _listeners[evtName] = [];
                    _listeners[evtName].push(obj);
                }
            }
            else {
                let msg = 'evtName: ' + evtName;
                msg += '\nprototype: ' + JSON.stringify(obj.prototype);
                msg += '\nCannot add object. Listener must implement notify()!';
                RG.err('EventPool', 'listenEvent', msg);
            }
        }
        else {
            RG.err('EventPool', 'listenEvent', 'Event name not well defined.');
        }
    };
};
RG.POOL = new RG.EventPool(); // Dangerous, global objects

//---------------------------------------------------------------------------
// MessageHandler
//---------------------------------------------------------------------------

/* Handles the game message listening and storing of the messages. */
RG.MessageHandler = function() { // {{{2

    let _lastMsg = null;

    let _messages = [];
    let _prevMessages = [];
    let _hasNew = false;

    this.hasNotify = true;
    this.notify = (evtName, msg) => {
        if (evtName === RG.EVT_MSG) {
            if (msg.hasOwnProperty('msg')) {
                const msgObj = {msg: msg.msg, style: 'prim', count: 1};

                if (msg.hasOwnProperty('cell')) {
                    msgObj.cell = msg.cell;
                }

                if (msg.hasOwnProperty('style')) {
                    msgObj.style = msg.style;
                }

                if (_lastMsg && _lastMsg.msg === msgObj.msg) {
                    _lastMsg.count += 1;
                }
                else {
                    _lastMsg = msgObj;
                    _messages.push(msgObj);
                }
                _hasNew = true;
            }
        }
    };
    RG.POOL.listenEvent(RG.EVT_MSG, this);

    this.hasNew = () => _hasNew;

    this.getMessages = () => {
        _hasNew = false;
        if (_messages.length > 0) {return _messages;}
        else if (_prevMessages.length > 0) {return _prevMessages;}
        else {return [];}
    };

    this.clear = () => {
        if (_messages.length > 0) {_prevMessages = _messages.slice();}
        _messages = [];
    };

}; // }}} Messages

module.exports = RG;

