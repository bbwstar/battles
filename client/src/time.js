
const ROT = require('../../lib/rot.js');
const RG = require('./rg.js');

RG.Time = {};

/* Models an action. Each action has a duration and a callback.  */
RG.Time.RogueAction = function(dur, cb, obj) { // {{{2

    var _duration = dur;
    var _cb = cb; // Action callback
    var _energy = 0;

    this.setEnergy = en => {_energy = en;};
    this.getEnergy = () => _energy;


    this.getDuration = () => _duration;

    this.doAction = () => {
        _cb(obj);
    };

}; // }}} Action

//---------------------------------------------------------------------------
// GAME EVENTS
//---------------------------------------------------------------------------

/* Event is something that is scheduled and takes place but it's not an actor.
 * An example is regeneration or poison effect.*/
RG.Time.GameEvent = function(dur, cb, repeat, offset) {

    // var _cb = cb;
    var _repeat = repeat;
    // var _nTimes = 1;
    var _offset = offset;

    var _level = null; // Level associated with the event, if null, global

    this.isEvent = true; // Needed for the scheduler

    /* Clunky for events, but must implement for the scheduler.*/
    this.isPlayer = () => false;

    this.nextAction = () => new RG.Time.RogueAction(dur, cb, {});

    this.getRepeat = () => _repeat;
    this.setRepeat = repeat => {_repeat = repeat;};

    this.getOffset = () => _offset;
    this.setOffset = offset => {_offset = offset;};

    this.setLevel = level => {_level = level;};
    this.getLevel = () => _level;

};

/* Regeneration event. Initialized with an actor. */
RG.Time.RegenEvent = function(actor, dur) {
    const _dur = dur; // Duration between events

    const _regenerate = () => {
        actor.get('Health').addHP(1);
    };

    RG.Time.GameEvent.call(this, _dur, _regenerate, true);
};
RG.extend2(RG.Time.RegenEvent, RG.Time.GameEvent);

/* Regeneration power points event. Initialized with an actor. */
RG.Time.RegenPPEvent = function(actor, dur) {
    const _dur = dur; // Duration between events

    const _regeneratePower = () => {
        actor.get('SpellPower').addPP(1);
    };

    RG.Time.GameEvent.call(this, _dur, _regeneratePower, true);
};
RG.extend2(RG.Time.RegenPPEvent, RG.Time.GameEvent);

/* Event that is executed once after an offset.*/
RG.Time.OneShotEvent = function(cb, offset, msg) {

    // Wraps the callback into function and emits a message
    var _cb = () => {
        if (!RG.isNullOrUndef([msg])) {
            RG.gameMsg(msg);
        }
        cb();
    };

    RG.Time.GameEvent.call(this, 0, _cb, false, offset);
};
RG.extend2(RG.Time.OneShotEvent, RG.Time.GameEvent);


/* Scheduler for the game actions.  */
RG.Time.Scheduler = function() { // {{{2

    // Internally use ROT scheduler
    var _scheduler = new ROT.Scheduler.Action();

    // Store the scheduled events
    var _events = [];
    var _actors = [];

    /* Adds an actor or event to the scheduler.*/
    this.add = (actOrEvent, repeat, offset) => {
        _scheduler.add(actOrEvent, repeat, offset);
        if (actOrEvent.hasOwnProperty('isEvent')) {
            _events.push(actOrEvent);
        }
        else {
            _actors.push(actOrEvent);
        }
    };

    // Returns next actor/event or null if no next actor exists.
    this.next = () => _scheduler.next();

    /* Must be called after next() to re-schedule next slot for the
     * actor/event.*/
    this.setAction = action => {
        _scheduler.setDuration(action.getDuration());
    };

    /* Tries to remove an actor/event, Return true if success.*/
    this.remove = function(actOrEvent) {
        if (actOrEvent.hasOwnProperty('isEvent')) {
            return this.removeEvent(actOrEvent);
        }
        else {
            const index = _actors.indexOf(actOrEvent);
            if (index !== -1) {
                _actors.splice(index, 1);
            }
        }
        return _scheduler.remove(actOrEvent);
    };

    /* Removes an event from the scheduler. Returns true on success.*/
    this.removeEvent = actOrEvent => {
        var index = -1;
        if (actOrEvent.hasOwnProperty('isEvent')) {
            index = _events.indexOf(actOrEvent);
            if (index !== -1) {
                _events.splice(index, 1);
            }
        }
        return _scheduler.remove(actOrEvent);

    };

    this.getTime = () => _scheduler.getTime();

    /* Hooks to the event system. When an actor is killed, removes it from the
     * scheduler.*/
    this.hasNotify = true;
    this.notify = function(evtName, args) {
        if (evtName === RG.EVT_ACTOR_KILLED) {
            if (args.hasOwnProperty('actor')) {
                this.remove(args.actor);
            }
        }
    };
    RG.POOL.listenEvent(RG.EVT_ACTOR_KILLED, this);


}; // }}} Scheduler

module.exports = RG.Time;
