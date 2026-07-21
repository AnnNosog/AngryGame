var STAR_THRESHOLDS = {
    1: [3, 5],
    2: [4, 6],
    3: [2, 4]
};

var DEFAULT_THRESHOLDS = [3, 5];

var BULLET_LAUNCH_POWER = 0.15;
var BULLET_SIZE = [28, 28];
var BULLET_LIFETIME = 2;
var BULLET_PHYSICS = {
    __isStatic: false,
    __friction: 130,
    __frictionAir: 0.2,
    __frictionStatic: 500,
    __restitution: 10,
    __density: 4,
    __bodyType: 1
};
var MAX_BULLETS = 3;

var BOOST_RADIUS = 34;
var BOOST_SPEED_MULT = 1.8;
var BOOST_LIFT = 15;
var BOOST_SPAWN_SPEED_MULT = 1.2;
var BOOST_SPAWN_LIFT = 20;

var AIM_DOTS_COUNT = 20;
var AIM_DOT_SIZE = [10, 10];
var AIM_FRICTION_AIR = 0.2;
var AIM_GRAVITY = 0.2;
var AIM_FRICTION_FRAME = 0.05;
var AIM_STEPS_PER_DOT = 3;

var DMG_SPEED_THRESHOLD = 3.5;
var DMG_MULT = 10;
var DMG_MAX = 100;
var BLOCK_HP = 100;

var SHARD_STEP = 50;
var SHARD_SIZE_MIN = 25;
var SHARD_SIZE_MAX = 35;
var SHARD_LIFETIME_MIN = 0.5;
var SHARD_LIFETIME_MAX = 1.5;
var SHARD_PER_FRAME = 12;
