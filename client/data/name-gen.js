/* eslint comma-dangle: 0 */

// Thanks to www.fantasynamegenerators.com for some tips

const Names = {};
const RG = require('../src/rg.js');

// There are two kinds of names:
// 1. Generic ones such as Dungeon, City, Town, Vault etc.
// 2. Unique ones such as Everhold or Ebonfell.

/* As the whole purpose of this module is to generate random names, each
 * function will return randomly picked values of course.
 */

Names.place = {};

/* Generic place names are placed here. */
Names.place.generic = {
    branch: [
        'Hand', 'Foot', 'Small', 'Large'
    ],
    dungeon: [
        'Crypt', 'Catacombs', 'Tombs',
        'Dungeon', 'Cells',
        'Cave', 'Grotto', 'Cavern',
        // 'Burrows', 'Delves',
        // 'Haunt', 'Point',
        // 'Vault', 'Lair', 'Tunnels', 'Pits',
        'Labyrinth' // , 'Maze'
    ],

    mountain: [
        'Summit', 'Volcano', 'Tops', 'Peaks',
        'Bluff', 'Highlands', 'Pinnacle', 'Rise', 'Needle', 'Hills',
        'Slopes'
    ],

    face: [
        'Face', 'Buttress', 'Ridge', 'Shoulder', 'Crag', 'Crest', 'Brink',
        'Cairn', 'Col', 'Pass', 'Crown', 'Scree', 'Watershed'
    ],

    forest: [
        'Grove', 'Wilds', 'Woodlands', 'Timberland', 'Forest', 'Covert',
        'Woods', 'Thicket', 'Glade',
    ],

    city: [
        'Town', 'Village', // 'Township', 'Hamlet',
        'Fort',
        // 'Stronghold', 'Fortress', 'Outpost', 'Castle',
        'City', // 'Capital',
        // 'Guard'
    ],
    lake: [
        'Basin', 'Cove', 'Reservoir', 'Depths', 'Gorge', 'Lagoon', 'Domain',
        'Pond', 'Expanse', 'Lake', 'Shallows', 'Loch', 'Falls', 'Rapids',
    ],

    quarter: [
        'Market', 'Bazaar',
        'Plaza', 'Row', 'Works', 'Side', 'Acre',
        'Garden', 'Park',
        'Temple', 'Necropolis', 'Cemetery',
        'Library', 'Arcane',
        'Royal', 'Slum', 'Living',
        'Arena', 'Military', 'Barracks'
    ],
    area: [

    ]

};

Names.place.unique = {
    city: {
        first: [
            'Stag', 'Small', 'Mud', 'Ebon', 'Silk', 'Spirit', 'Basin',
            'Shadow', 'Gold', 'Snow', 'Frost', 'Ice', 'Hound', 'Moon',
            'Dire', 'Ever', 'Iron', 'Ruby', 'Star', 'Crystal', 'Glimmer',
            'Winters', 'Raven', 'Pine', 'Ever', 'Never'
        ],
        second: [
            'guard', 'point', 'fell', 'mire', 'shield', 'crest', 'yard',
            'minster', 'swallow', 'grasp', 'cliff', 'cross', 'host', 'barrow',
            'vein', 'view', 'home'
        ]
    },
};

Names.actor = {

};

Names.item = {

};

Names.getVillageType = () => {
    return RG.RAND.arrayGetRand(['Village', 'Hamlet', 'Town', 'Township']);
};

Names.getUniqueCityName = () => {
    const first = RG.RAND.arrayGetRand(Names.place.unique.city.first);
    const second = RG.RAND.arrayGetRand(Names.place.unique.city.second);
    return first + second;
};

Names.getGenericPlaceName = (type) => {
    const arr = Names.place.generic[type];
    return RG.RAND.arrayGetRand(arr);
};

module.exports = Names;

