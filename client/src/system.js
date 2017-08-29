
const RG = require('./rg.js');

//---------------------------------------------------------------------------
// ECS SYSTEMS {{{1
//---------------------------------------------------------------------------

RG.System = {};

/* Base class for all systems in ECS framework.*/
RG.System.Base = function(type, compTypes) {

    this.type = type;           // Type of the system
    this.compTypes = compTypes; // Required comps in entity
    this.entities = {};         // Entities requiring processing

    // If set to true, only one comp has to match the compTypes, otherwise all
    // components in compTypes must be present
    this.compTypesAny = false;

    this.addEntity = function(entity) {
        this.entities[entity.getID()] = entity;
    };

    this.removeEntity = function(entity) {
        delete this.entities[entity.getID()];
    };

    /* Listens to add/removes for each component type in compTypes.*/
    this.hasNotify = true;
    this.notify = function(evtName, obj) {
        if (obj.hasOwnProperty('add')) {
            if (this.hasCompTypes(obj.entity)) {this.addEntity(obj.entity);}
        }
        else if (obj.hasOwnProperty('remove')) {
            // Must check if any needed comps are still present, before removing
            // the entity
            if (!this.hasCompTypes(obj.entity)) {
                this.removeEntity(obj.entity);
            }
        }
    };

    /* Returns true if entity has all required component types, or if
     * compTypesAny if set, if entity has any required component.*/
    this.hasCompTypes = function(entity) {
        if (this.compTypesAny === false) { // All types must be present
            for (let i = 0; i < compTypes.length; i++) {
                if (!entity.has(compTypes[i])) {return false;}
            }
            return true;
        }
        else { // Only one compType has to be present
            for (let j = 0; j < compTypes.length; j++) {
                if (entity.has(compTypes[j])) {return true;}
            }
            return false;
        }
    };

    // Add a listener for each specified component type
    for (let i = 0; i < this.compTypes.length; i++) {
        RG.POOL.listenEvent(this.compTypes[i], this);
    }

    this.update = function() {
        for (const e in this.entities) {
            if (!e) {continue;}
            this.updateEntity(this.entities[e]);
        }
    };

};

/* Processes entities with attack-related components.*/
RG.System.Attack = function(type, compTypes) {
    RG.System.Base.call(this, type, compTypes);

    this.updateEntity = function(ent) {
        const att = ent;
        const def = ent.get('Attack').getTarget();
        const aName = att.getName();
        const dName = def.getName();

        if (def.has('Ethereal')) {
            RG.gameMsg({cell: att.getCell(),
                msg: 'Attack of ' + aName + ' passes through ' + dName});
        }
        else {
            // Actual hit change calculation
            const totalAttack = RG.getMeleeAttack(att);
            const totalDefense = def.getDefense();
            const hitChance = totalAttack / (totalAttack + totalDefense);

            if (hitChance > RG.RAND.getUniform()) {
                const totalDamage = att.getDamage();
                if (totalDamage > 0) {this.doDamage(att, def, totalDamage);}
                else {
                    RG.gameMsg({cell: att.getCell,
                        msg: aName + ' fails to hurt ' + dName});
                }
            }
            else {
                RG.gameMsg({cell: att.getCell(),
                    msg: aName + ' misses ' + dName});
            }
            def.addEnemy(att);
            att.getBrain().getMemory().setLastAttacked(def);
        }
        ent.remove('Attack');
    };

    this.doDamage = function(att, def, dmg) {
        const dmgComp = new RG.Component.Damage(dmg, 'cut');
        dmgComp.setSource(att);
        def.add('Damage', dmgComp);
        RG.gameWarn({cell: att.getCell(),
            msg: att.getName() + ' hits ' + def.getName()});
    };
};
RG.extend2(RG.System.Attack, RG.System.Base);

// Missile has
// srcX/Y, targetX/X, path, currX/Y, shooter + all damage components, item ref
// SourceComponent, TargetComponent, LocationComponent, OwnerComponent

/* Processes all missiles launched by actors/traps/etc.*/
RG.System.Missile = function(type, compTypes) {
    RG.System.Base.call(this, type, compTypes);

    this.updateEntity = function(ent) {
        const mComp = ent.get('Missile');
        const level = mComp.getLevel();
        const map = level.getMap();

        const targetX = mComp.getTargetX();
        const targetY = mComp.getTargetY();
        const targetCell = map.getCell(targetX, targetY);
        if (targetCell.hasProp('actors')) {
            const targetActor = targetCell.getProp('actors')[0];
            const attacker = mComp.getSource();
            attacker.getBrain().getMemory().setLastAttacked(targetActor);
        }

        while (mComp.isFlying() && !mComp.inTarget() && mComp.hasRange()) {

            // Advance missile to next cell
            mComp.next();
            const currX = mComp.getX();
            const currY = mComp.getY();
            const currCell = map.getCell(currX, currY);

            let shownMsg = '';
            // Wall was hit, stop missile
            if (currCell.hasPropType('wall')) {
                mComp.prev();
                const prevX = mComp.getX();
                const prevY = mComp.getY();
                const prevCell = map.getCell(prevX, prevY);

                this.finishMissileFlight(ent, mComp, prevCell);
                RG.debug(this, 'Stopped missile to wall');
                shownMsg = ent.getName() + ' thuds to the wall';
            }
            else if (currCell.hasProp('actors')) {
                const actor = currCell.getProp('actors')[0];
                // Check hit and miss
                if (this.targetHit(actor, mComp)) {
                    this.finishMissileFlight(ent, mComp, currCell);
                    const dmg = mComp.getDamage();
                    const damageComp = new RG.Component.Damage(dmg,
                        'thrust');
                    damageComp.setSource(mComp.getSource());
                    damageComp.setDamage(mComp.getDamage());
                    actor.add('Damage', damageComp);
                    RG.debug(this, 'Hit an actor');
                    shownMsg = ent.getName() + ' hits ' + actor.getName();
                }
                else if (mComp.inTarget()) {
                    this.finishMissileFlight(ent, mComp, currCell);
                    RG.debug(this, 'In target cell, and missed an entity');
                    shownMsg = ent.getName() + ' misses the target';
                }
                else if (!mComp.hasRange()) {
                    this.finishMissileFlight(ent, mComp, currCell);
                    RG.debug(this, 'Missile out of range. Missed entity.');
                    shownMsg = ent.getName() + ' misses the target';
                }
            }
            else if (mComp.inTarget()) {
                this.finishMissileFlight(ent, mComp, currCell);
                RG.debug(this, 'In target cell but no hits');
                shownMsg = ent.getName() + " doesn't hit anything";
            }
            else if (!mComp.hasRange()) {
                this.finishMissileFlight(ent, mComp, currCell);
                RG.debug(this, 'Missile out of range. Hit nothing.');
                shownMsg = ent.getName() + " doesn't hit anything";
            }
            if (shownMsg.length > 0) {
                RG.gameMsg({cell: currCell, msg: shownMsg});
            }
        }

    };

    this.finishMissileFlight = function(ent, mComp, currCell) {
        mComp.stopMissile(); // Target reached, stop missile
        ent.remove('Missile');
        const level = mComp.getLevel();
        level.addItem(ent, currCell.getX(), currCell.getY());

        const args = {
            missile: mComp,
            to: [currCell.getX(), currCell.getY()]
        };
        const animComp = new RG.Component.Animation(args);
        ent.add('Animation', animComp);
    };

    /* Returns true if the target was hit.*/
    this.targetHit = function(target, mComp) {
        const attack = mComp.getAttack();
        const defense = target.get('Combat').getDefense();
        const hitProp = attack / (attack + defense);
        const hitRand = RG.RAND.getUniform();
        if (hitProp > hitRand) {return true;}
        return false;
    };

};
RG.extend2(RG.System.Missile, RG.System.Base);

/* Processes entities with damage component.*/
RG.System.Damage = function(type, compTypes) {
    RG.System.Base.call(this, type, compTypes);

    this.updateEntity = function(ent) {
        if (ent.has('Health')) {
            const health = ent.get('Health');
            let totalDmg = _getDamageReduced(ent);

            // Check if any damage was done at all
            if (totalDmg <= 0) {
                totalDmg = 0;
                RG.gameMsg("Attack doesn't penetrate protection of "
                    + ent.getName());
            }
            else {
                _applyAddOnHitComp(ent);
                health.decrHP(totalDmg);
            }

            if (health.isDead()) {
                if (ent.has('Loot')) {
                    const entCell = ent.getCell();
                    ent.get('Loot').dropLoot(entCell);
                }
                _dropInvAndEq(ent);

                const src = ent.get('Damage').getSource();
                _killActor(src, ent);
            }
            ent.remove('Damage'); // After dealing damage, remove comp
        }
    };

    /* Checks if protection checks can be applied to the damage caused. For
     * damage like hunger and poison, no protection helps.*/
    const _getDamageReduced = function(ent) {
        const dmgComp = ent.get('Damage');
        const dmg = dmgComp.getDamage();
        const src = dmgComp.getSource();

        if (src !== null) {ent.addEnemy(src);}

        // Deal with "internal" damage bypassing protection here
        if (dmgComp.getDamageType() === 'poison') {
            const cell = ent.getCell();
            const msg = 'Poison is gnawing inside ' + ent.getName();
            RG.gameDanger({cell, msg});
            return dmg;
        }
        else if (dmgComp.getDamageType() === 'hunger') {
            return dmg;
        }

        // Take defs protection value into account
        const protEquip = ent.getEquipProtection();
        const protStats = ent.get('Combat').getProtection();
        const protTotal = protEquip + protStats;
        const totalDmg = dmg - protTotal;
        return totalDmg;
    };

    /* Applies add-on hit effects such as poison, frost or others. */
    const _applyAddOnHitComp = function(ent) {
        const dmgComp = ent.get('Damage');
        const weapon = dmgComp.getWeapon();
        if (weapon) { // Attack was done using weapon
            if (weapon.has('AddOnHit')) {
                const comp = weapon.get('AddOnHit').getComp();
                RG.addCompToEntAfterHit(comp, ent);
            }
        }
        else { // No weapon was used
            const src = dmgComp.getSource();
            if (src && src.has('AddOnHit')) {
                const comp = src.get('AddOnHit').getComp();
                RG.addCompToEntAfterHit(comp, ent);
            }
        }
    };

    const _dropInvAndEq = function(actor) {
        const cell = actor.getCell();
        const x = cell.getX();
        const y = cell.getY();
        const invEq = actor.getInvEq();
        const items = invEq.getInventory().getItems();
        items.forEach(item => {
            if (invEq.removeNItems(item, item.count)) {
                const rmvItem = invEq.getRemovedItem();
                actor.getLevel().addItem(rmvItem, x, y);
            }
        });

        // TODO remove equipped items and drop to ground.
    };

    /* Removes actor from current level and emits Actor killed event.*/
    const _killActor = function(src, actor) {
        const dmgComp = actor.get('Damage');
        const level = actor.getLevel();
        const cell = actor.getCell();
        if (level.removeActor(actor)) {
            if (actor.has('Experience')) {
                _giveExpToSource(src, actor);
            }
            const dmgType = dmgComp.getDamageType();
            if (dmgType === 'poison') {
                RG.gameDanger({cell,
                    msg: actor.getName() + ' dies horribly of poisoning!'});
            }

            let killMsg = actor.getName() + ' was killed';
            if (src !== null) {killMsg += ' by ' + src.getName();}

            RG.gameDanger({cell, msg: killMsg});
            RG.POOL.emitEvent(RG.EVT_ACTOR_KILLED, {actor});
        }
        else {
            RG.err('System.Combat', 'killActor', "Couldn't remove actor");
        }
    };

    /* When an actor is killed, gives experience to damage's source.*/
    const _giveExpToSource = function(att, def) {
        if (att !== null) {
            const defLevel = def.get('Experience').getExpLevel();
            const defDanger = def.get('Experience').getDanger();
            const expPoints = new RG.Component.ExpPoints(defLevel + defDanger);
            att.add('ExpPoints', expPoints);
        }
    };

};
RG.extend2(RG.System.Damage, RG.System.Base);

/* Called for entities which gained experience points recently.*/
RG.ExpPointsSystem = function(type, compTypes) {
    RG.System.Base.call(this, type, compTypes);

    this.updateEntity = function(ent) {
        const expComp = ent.get('Experience');
        const expPoints = ent.get('ExpPoints');
        const expLevel = expComp.getExpLevel();

        let exp = expComp.getExp();
        exp += expPoints.getExpPoints();
        expComp.setExp(exp);

        const nextLevel = expLevel + 1;
        let reqExp = 0;
        for (let i = 1; i <= nextLevel; i++) {
            reqExp += (i - 1) * 10;
        }

        if (exp >= reqExp) { // Required exp points exceeded
            RG.levelUpActor(ent, nextLevel);
            const name = ent.getName();
            const msg = `${name} appears to be more experience now.`;
            RG.gameSuccess({msg: msg, cell: ent.getCell()});
        }
        ent.remove('ExpPoints');
    };

};

RG.extend2(RG.ExpPointsSystem, RG.System.Base);

/* This system handles all entity movement.*/
RG.System.Movement = function(type, compTypes) {
    RG.System.Base.call(this, type, compTypes);

    this.updateEntity = function(ent) {
        const x = ent.get('Movement').getX();
        const y = ent.get('Movement').getY();
        const level = ent.get('Movement').getLevel();
        const map = level.getMap();
        const cell = map.getCell(x, y);
        const prevCell = ent.getCell();

        if (cell.isFree(ent.has('Flying'))) {
            const xOld = ent.getX();
            const yOld = ent.getY();
            RG.debug(this, 'Trying to move ent from ' + xOld + ', ' + yOld);

            const propType = ent.getPropType();
            if (map.removeProp(xOld, yOld, propType, ent)) {
                map.setProp(x, y, propType, ent);
                ent.setXY(x, y);

                if (ent.hasOwnProperty('isPlayer')) {
                    if (ent.isPlayer()) {
                        this.checkMessageEmits(prevCell, cell);
                    }
                }

                ent.remove('Movement');
                return true;
            }
            else {
                const coord = xOld + ', ' + yOld;
                RG.err('MovementSystem', 'moveActorTo',
                    "Couldn't remove ent |" + ent.getName() + '| @ ' + coord);
            }
        }
        else {
            RG.debug(this, "Cell wasn't free at " + x + ', ' + y);
        }
        ent.remove('Movement');
        return false;
    };

    /* If player moved to the square, checks if any messages must
     * be emitted. */
    this.checkMessageEmits = function(prevCell, newCell) {
        if (newCell.hasStairs()) {
            const stairs = newCell.getStairs();
            const level = stairs.getTargetLevel();
            let msg = 'You see stairs here';
            if (level.getParent()) {
                const name = level.getParent();
                msg += `. They seem to be leading to ${name}`;
            }
            RG.gameMsg(msg);
        }
        else if (newCell.hasPassage()) {
            const passage = newCell.getPassage();
            const level = passage.getSrcLevel();
            const dir = RG.getCardinalDirection(level, newCell);
            const msg = `You see a passage here leading to ${dir}.`;
            RG.gameMsg(msg);
        }

        const hasItems = newCell.hasProp('items');

        if (hasItems) {
            const items = newCell.getProp('items');
            const topItem = items[0];
            let topItemName = topItem.getName();
            if (topItem.count > 1) {
                topItemName = topItem.count + ` ${topItemName}`;
                if (!(/s$/).test(topItemName)) {
                    topItemName += 's';
                }
            }

            if (items.length > 1) {
                RG.gameMsg('There are several items here. ' +
                    `You see ${topItemName} on top`);
            }
            else if (topItem.count > 1) {
                RG.gameMsg(`There are ${topItemName} on the floor`);
            }
            else {
                RG.gameMsg(topItemName + ' is on the floor');
            }
            if (topItem.has('Unpaid')) {
                if (topItem.count > 1) {RG.gameMsg('They are for sale');}
                else {RG.gameMsg('It is for sale');}
            }
        }

        if (!prevCell.hasShop() && newCell.hasShop()) {
            RG.gameMsg('You have entered a shop.');
        }
        else if (newCell.hasShop()) {
            RG.gameMsg('You can drop items to sell here.');
        }

        const baseType = newCell.getBaseElem().getType();
        let baseMsg = '';
        switch (baseType) {
            case 'tree': baseMsg = 'There is a tree here.'; break;
            case 'grass': baseMsg = 'You see some grass.'; break;
            case 'snow': baseMsg = 'Ground is covered with snow.'; break;
            case 'road': baseMsg = 'You tread lightly on the road.'; break;
            default: break;
        }
        if (baseMsg.length > 0) {
            RG.gameMsg(baseMsg);
        }
    };

};
RG.extend2(RG.System.Movement, RG.System.Base);


/* Stun system removes Movement/Attack components from actors to prevent. */
RG.System.Stun = function(type, compTypes) {
    RG.System.Base.call(this, type, compTypes);

    this.updateEntity = function(ent) {
        if (ent.has('Attack')) {
            ent.remove('Attack');
            RG.gameMsg({cell: ent.getCell(),
                msg: ent.getName() + ' is too stunned to attack.'});
        }
        else if (ent.has('Movement')) {
            ent.remove('Movement');
            RG.gameMsg({cell: ent.getCell(),
                msg: ent.getName() + ' is too stunned to move.'});
        }
    };

};
RG.extend2(RG.System.Stun, RG.System.Base);

/* Processes entities with hunger component.*/
RG.System.Hunger = function(type, compTypes) {
    RG.System.Base.call(this, type, compTypes);

    this.updateEntity = function(ent) {
        const hungerComp = ent.get('Hunger');
        const actionComp = ent.get('Action');
        hungerComp.decrEnergy(actionComp.getEnergy());
        actionComp.resetEnergy();
        if (hungerComp.isStarving()) {
            // Don't make hunger damage too obvious
            const takeDmg = RG.RAND.getUniform();
            if (ent.has('Health') && takeDmg < RG.HUNGER_PROB) {
                const dmg = new RG.Component.Damage(RG.HUNGER_DMG,
                    'hunger');
                ent.add('Damage', dmg);
                RG.gameWarn(ent.getName() + ' is starving!');
            }
        }
    };

};
RG.extend2(RG.System.Hunger, RG.System.Base);

/* Processes entities with communication component.*/
RG.System.Communication = function(type, compTypes) {
    RG.System.Base.call(this, type, compTypes);

    // Each entity here has received communication and must capture its
    // information contents
    this.updateEntity = function(ent) {
        const comComp = ent.get('Communication');
        const messages = comComp.getMsg();
        for (let i = 0; i < messages.length; i++) {
            this.processMessage(ent, messages[i]);
        }
        ent.remove('Communication');
    };

    this.processMessage = function(ent, msg) {
        if (_msgFunc.hasOwnProperty(msg.type)) {
            _msgFunc[msg.type](ent, msg);
        }
        else {
            RG.err('CommunicationSystem', 'processMessage',
                'No function for msg type |' + msg.type + '| in dtable.');
        }
    };

    this.processEnemies = function(ent, msg) {
        const enemies = msg.enemies;
        const srcName = msg.src.getName();
        for (let i = 0; i < enemies.length; i++) {
            ent.addEnemy(enemies[i]);
        }
        const msgObj = {cell: ent.getCell(),
            msg: `${srcName} seems to communicate with ${ent.getName()}`
        };
        RG.gameDanger(msgObj);
    };

    // Dispatch table for different messages
    const _msgFunc = {
        Enemies: this.processEnemies
    };

};
RG.extend2(RG.System.Communication, RG.System.Base);

/* System which handles time-based effects like poisoning etc. It also handles
 * expiration of effects. This is a special system because its updates are
 * scheduled by the scheduler to guarantee a specific execution interval. */
RG.System.TimeEffects = function(type, compTypes) {
    RG.System.Base.call(this, type, compTypes);
    this.compTypesAny = true;

    // Dispatch table used to call a handler function for each component
    const _dtable = {};
    let _expiredEffects = [];

    this.update = function() {
        for (const e in this.entities) {
            if (!e) {continue;}
            const ent = this.entities[e];

            // Process timed effects like poison etc.
            for (let i = 0; i < compTypes.length; i++) {
                if (compTypes[i] !== 'Expiration') {
                    if (ent.has(compTypes[i])) {
                        // Call dispatch table function
                        _dtable[compTypes[i]](ent);
                    }
                }
            }
            // Process expiration effects/duration of Expiration itself
            if (ent.has('Expiration')) {_decreaseDuration(ent);}
        }

        // Remove expired effects (mutates this.entities, so done outside for)
        // Removes Expiration, as well as comps like Poison/Stun/Disease etc.
        for (let j = 0; j < _expiredEffects.length; j++) {
            const compName = _expiredEffects[j][0];
            const entRem = _expiredEffects[j][1];
            entRem.remove(compName);
        }
        _expiredEffects = [];
    };

    /* Decreases the remaining duration in the component by one.*/
    const _decreaseDuration = function(ent) {
        const tEff = ent.get('Expiration');
        tEff.decrDuration();

        // Remove Expiration only if other components are removed
        if (!tEff.hasEffects()) {
            _expiredEffects.push(['Expiration', ent]);
        }
    };


    /* Applies the poison effect to the entity.*/
    const _applyPoison = function(ent) {
        const poison = ent.get('Poison');

        if (ent.get('Health').isDead()) {
            _expiredEffects.push(['Poison', ent]);
            if (ent.has('Expiration')) {
                const te = ent.get('Expiration');
                if (te.hasEffect(poison)) {
                    te.removeEffect(poison);
                }
            }
        }
        else if (RG.RAND.getUniform() < poison.getProb()) {
            const poisonDmg = poison.rollDamage();
            const dmg = new RG.Component.Damage(poisonDmg, 'poison');
            dmg.setSource(poison.getSource());
            ent.add('Damage', dmg);
        }
    };

    _dtable.Poison = _applyPoison;

    /* Used for debug printing.*/
    this.printMatchedType = function(ent) {
        for (let i = 0; i < this.compTypes.length; i++) {
            if (ent.has(this.compTypes[i])) {
                RG.debug(this.compTypes[i], 'Has component');
            }
        }
    };

};
RG.extend2(RG.System.Communication, RG.System.Base);

/* System which processes the spell casting components. This system checks if
 * the spell casting succeeds and then handles PP reduction, but it does not
 * execute the effects of the spell.*/
RG.System.SpellCast = function(type, compTypes) {
    RG.System.Base.call(this, type, compTypes);

    this.updateEntity = function(ent) {
        const name = ent.getName();
        const cell = ent.getCell();
        const spellcast = ent.get('SpellCast');

        // TODO add checks for impairment, counterspells etc

        if (ent.has('SpellPower')) {
            const ppComp = ent.get('SpellPower');
            const spell = spellcast.getSpell();
            if (spell.getPower() <= ppComp.getPP()) {
                const args = spellcast.getArgs();
                spell.cast(args);
                ppComp.decrPP(spell.getPower());
            }
            else {
                const msg = `${name} has no enough power to cast spell`;
                RG.gameMsg({cell: cell, msg: msg});
            }
        }
        else {
            const msg = `${name} has no power to cast spells!`;
            RG.gameMsg({cell: cell, msg: msg});
        }
        ent.remove('SpellCast');
    };

};
RG.extend2(RG.System.SpellCast, RG.System.Base);

/* SpellEffect system processes the actual effects of spells, and creates damage
 * dealing components etc. An example if FrostBolt which creates SpellRay
 * component for each cell it's travelling to. */
RG.System.SpellEffect = function(type, compTypes) {
    RG.System.Base.call(this, type, compTypes);
    this.compTypesAny = true; // Process with any relavant Spell comp

    this.updateEntity = function(ent) {
        if (ent.has('SpellRay')) {
            this.processSpellRay(ent);
        }
        else if (ent.has('SpellCell')) {
            this.processSpellCell(ent);
        }
    };

    this.processSpellRay = function(ent) {
        const ray = ent.get('SpellRay');
        const args = ray.getArgs();
        const map = ent.getLevel().getMap();
        const spell = args.spell;
        const name = spell.getName();

        let x = args.from[0];
        let y = args.from[1];
        const dX = args.dir[0];
        const dY = args.dir[1];
        let rangeLeft = spell.getRange();
        let rangeCrossed = 0;
        while (rangeLeft > 0) {
            x += dX;
            y += dY;
            if (map.hasXY(x, y)) {
                const cell = map.getCell(x, y);
                if (cell.hasActors()) {
                    // Deal some damage etc
                    const dmg = new RG.Component.Damage();
                    dmg.setSource(ent);
                    dmg.setDamageType(args.damageType);
                    dmg.setDamage(args.damage);

                    const actor = cell.getActors()[0];
                    // TODO add some evasion checks
                    // TODO add onHit callback for spell because not all spells
                    // cause damage
                    actor.add('Damage', dmg);
                    RG.gameMsg({cell: cell,
                        msg: `${name} hits ${actor.getName()}`});
                }
                if (!cell.isSpellPassable()) {
                    rangeLeft = 0;
                }
                else {
                    ++rangeCrossed;
                }
                --rangeLeft;
            }
            else {
                rangeLeft = 0;
            }
        }
        ent.remove('SpellRay');
        const animArgs = {
            dir: args.dir,
            ray: true,
            from: args.from,
            range: rangeCrossed,
            style: args.damageType
        };
        const animComp = new RG.Component.Animation(animArgs);
        ent.add('Animation', animComp);
    };

    this.processSpellCell = function(ent) {
        const spellComp = ent.get('SpellCell');
        const args = spellComp.getArgs();
        const map = ent.getLevel().getMap();
        const spell = args.spell;
        const name = spell.getName();

        const dX = args.dir[0];
        const dY = args.dir[1];
        const x = args.from[0] + dX;
        const y = args.from[1] + dY;

        if (map.hasXY(x, y)) {
            const cell = map.getCell(x, y);
            if (cell.hasActors()) {
                const actor = cell.getActors()[0];
                if (args.targetComp) {
                    const setFunc = args.set;
                    const getFunc = args.get;
                    if (actor.has(args.targetComp)) {
                        const comp = actor.get(args.targetComp);
                        const actorName = actor.getName();
                        if (getFunc) {
                            comp[setFunc](comp[getFunc()] + args.value);
                        }
                        else {
                            comp[setFunc](args.value);
                        }
                        RG.gameMsg({cell: cell,
                            msg: `Spell ${name} is cast on ${actorName}`});
                    }
                }
                else {
                    // Deal some damage etc
                    const dmg = new RG.Component.Damage();
                    dmg.setSource(ent);
                    dmg.setDamageType(args.damageType);
                    dmg.setDamage(args.damage);

                    // TODO add some evasion checks
                    // TODO add onHit callback for spell because not all spells
                    // cause damage
                    actor.add('Damage', dmg);
                    RG.gameMsg({cell: cell,
                        msg: `${name} hits ${actor.getName()}`});
                }
            }

            const animArgs = {
                cell: true,
                coord: [[x, y]],
                style: args.damageType || ''
            };
            const animComp = new RG.Component.Animation(animArgs);
            ent.add('Animation', animComp);
        }

        ent.remove('SpellCell');
    };

};
RG.extend2(RG.System.SpellEffect, RG.System.Base);

/* System which constructs the animations to play. */
RG.System.Animation = function(type, compTypes) {
    RG.System.Base.call(this, type, compTypes);

    this.updateEntity = function(ent) {
        const animComp = ent.get('Animation');
        const args = animComp.getArgs();
        if (args.dir) {
            this.lineAnimation(args);
        }
        else if (args.missile) {
            this.missileAnimation(args);
        }
        else if (args.cell) {
            this.cellAnimation(args);
        }
        ent.remove('Animation');
    };

    /* Construct a missile animation from Missile component. */
    this.missileAnimation = function(args) {
        const mComp = args.missile;
        const xEnd = args.to[0];
        const yEnd = args.to[0];
        const xy = mComp.first();
        let xCurr = xy[0];
        let yCurr = xy[1];

        const animation = new RG.Animation.Animation();
        while (xCurr !== xEnd && yCurr !== yEnd) {
            const frame = {};
            const key = xCurr + ',' + yCurr;
            frame[key] = {};
            frame[key].char = '/';
            frame[key].className = 'cell-item-missile';
            animation.addFrame(frame);

            if (mComp.next()) {
                xCurr = mComp.getX();
                yCurr = mComp.getY();
            }
            else {
                break;
            }
        }
        RG.POOL.emitEvent(RG.EVT_ANIMATION, {animation});
    };

    /* Constructs line animation (a bolt etc). */
    this.lineAnimation = function(args) {
        let x = args.from[0];
        let y = args.from[1];
        const dX = args.dir[0];
        const dY = args.dir[1];
        let rangeLeft = args.range;

        const animation = new RG.Animation.Animation();
        const frame = {};
        if (args.ray) {
            while (rangeLeft > 0) {
                x += dX;
                y += dY;
                frame[x + ',' + y] = {
                    char: 'X',
                    className: 'cell-ray'
                };

                const frameCopy = Object.assign({}, frame);
                animation.addFrame(frameCopy);

                --rangeLeft;
            }
        }
        // No ref to engine, thus emit an event, engine will catch it
        RG.POOL.emitEvent(RG.EVT_ANIMATION, {animation});
    };

    this.cellAnimation = function(args) {
        const animation = new RG.Animation.Animation();
        const frame = {};
        animation.slowDown = 10;
        args.coord.forEach(xy => {
            frame[xy[0] + ',' + xy[1]] = {
                char: '*',
                className: 'cell-animation'
            };
        });

        animation.addFrame(frame);
        RG.POOL.emitEvent(RG.EVT_ANIMATION, {animation});
    };
};
RG.extend2(RG.System.Animation, RG.System.Base);

// }}} SYSTEMS

module.exports = RG.System;
