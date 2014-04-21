window.addEventListener("load",function() {
 
	var Q = Quintus({ development: true, audioSupported: ['wav', 'ogg', 'mp3'] })
	    .include("Sprites, Scenes, Input, 2D, Anim, TMX, Audio, Touch, UI");

	Q.setup({
	    width: 480,
	    height: 320,
	    scaleToFit: true
	}).enableSound().controls(true).touch();
 

	Q.animations('flor', { quieta: { frames: [0, 1], rate: 1.2 } });

	// Q.debug = true;

	// The map is 6 tiles larger because the enemies
	Q.tileSize    = 16;
	var mapBoundaries = {
							minX: Q.tileSize * 3,
							maxX: Q.tileSize * 33
						};

	// The player
	Q.Sprite.extend("Flower", {
		init: function(p) {
			this._super(p, {
				sheet: "flor", 
				sprite: 'flor', 
				scale: 0.9,  
				x: Q.tileSize * 36 / 2,
				y: Q.el.height / 2, 
				coins: 0,
				boundaries: mapBoundaries
			}); 

			this.p.points = [
				[-this.p.w/4, -this.p.h/2], 
				[this.p.w/4, -this.p.h/2], 
				[this.p.w/4, this.p.h/2], 
				[-this.p.w/4, this.p.h/2]
			];

			// Add 2d and animation modules plus the Leaf Thrower component.
			this.add('2d, animation');
			this.add('LeafThrower');

			this.on('bump.bottom', this,'kill');
			this.on('bump.left', this, 'watered');
			this.on('bump.right', this, 'watered');
		} ,
		watered: function(col) {
			if(col.obj.isA('Gardener')) {
				this.destroy();
				Q.audio.play('choque.ogg');
				setTimeout(function() {
					Q.stageScene('game');
				}, 1000);
			}
		},
		kill: function(col) 
		{	

			if(col.obj.isA('Gardener')){ 
				col.obj.destroy();
				this.p.vy = -300;

				var coin = new Q.Coin({ x: col.obj.p.x, y: col.obj.p.y });
				this.stage.insert(coin);
				Q.audio.play('coin.ogg');

				setTimeout(function() {
					coin.destroy();
				}, 1000);

				this.p.coins = this.p.coins + coin.p.value;
				Q.stageScene('hud', 2, {
					coins: this.p.coins
				})
			}
		},
		step: function(dt) { 

			if(this.p.x <= this.p.cx + this.p.boundaries.minX) {
				this.p.x = this.p.cx + this.p.boundaries.minX;
			} else if( this.p.x > this.p.boundaries.maxX - this.p.cx) {
				this.p.x = this.p.boundaries.maxX - this.p.cx;
			}


			if(this.p.y > 193){
				this.p.landed = 1;
			} else {
				this.p.landed = 0;
			}

			if(this.p.landed == 1) { 
				this.p.vx = 0;
			}

			if((Q.inputs['left'] || Q.inputs['right']) && this.p.landed > 0){
				this.p.vy = -400;
				this.p.vx = (Q.inputs['left'] ? -1 : 1 )* 50;
				Q.audio.play('jump.ogg');
			}
		}
	});

	Q.Sprite.extend("Gardener", {
		init: function(p) { 

			this._super(p, {
				sheet: 'jardinero-' + Math.round(Math.random()*2 + 1),
				sprite: 'jardineros', 
				y: 194,
				speed: Math.floor((Math.random() * 50 + 50)),
				follow: false,
				type: 0,
				boundaries: mapBoundaries
			});

			this.p.x = Math.round(Math.random()) == 0 ? -1 : (Q.el.width + this.p.w);

			// Collision points depending of the direction
			if(this.p.x < 0) {
				this.p.flip = 'x';
				this.p.points = [[5, -30], [-20, -30], [-20, 28], [5, 28]]
			} else {
				this.p.points = [[0, -30],[0, 28], [20, 28], [20, -30]];
			}

			this.add('2d');
		}, 
		step: function(dt) { 
			if( (this.p.x + this.p.w/2 < this.p.boundaries.minX && this.p.vx < 0) || (this.p.vx > 0 && this.p.x - this.p.w/2 > this.p.boundaries.maxX)) {
				this.destroy();
				return;
			}
  
			this.p.vy = 0;
			this.p.vx = (this.p.flip != 'x' ? -1 : 1) * this.p.speed;
		}
	});

	Q.Sprite.extend('Leaf', {
		init: function(p) {
			this._super(p, {
				sheet: 'leaf',
				sprite: 'leaf',
				speed: 200
			}); 
		},
		step: function(dt) {
			this.p.x -= this.p.speed * dt;

			if(this.p.x > Q.el.width || this.p.x < 0) {
				this.destroy();
			}
		}
	});

	var coins = [0.5, 0.2, 5, 0.1, 0.2, 1]; // '10c', '20c', '50c', '1s', '2s', '5s']
	Q.Sprite.extend('Coin', {
		init: function(p) {
			var coin =  Math.round(Math.random() * 4 + 1);
			this._super(p, {
				sheet: 'coin-' + coin,
				sprite: 'coins',
				sensor: true, 
				value: coins[coin-1],
				type: 0
			});

			this.add('2d');
			this.on('sensor');
		},
		step: function() {
			this.p.vy = -50;
		}
	});

	Q.component('LeafThrower', {
		added: function() {
			// Keeping track of the leafs the flower shoot
			this.entity.p.leafs    = [];
			this.entity.p.canThrow = true;
			this.entity.on('step', 'throwing');
		},
		extend: {
			throwing: function(dt) {
				var entity = this;

				for(var i = entity.p.leafs.length - 1; i>= 0; i--) {
					if(entity.p.leafs[i].isDestroyed) {
						entity.p.leafs.splice(i, 1);
					}
				}

				if(Q.inputs['fire']) {
					this.shoot();
				}
			},
			shoot: function() { 
				var entity = this;

				if( ! entity.p.canThrow) {
					return;
				}

				var leaf   = Q.stage().insert(new Q.Leaf({ x: entity.p.x + entity.p.cx, y: entity.p.y  , type: 0 }));

				entity.p.leafs.push(leaf); 
				entity.p.canThrow = false;

				setTimeout(function() {
					entity.p.canThrow = true;
				}, 500);
			}
		}
	});

	Q.scene('hud', function(stage) {
	  var container = stage.insert(new Q.UI.Container({
	    x: 50, y: 0
	  }));

	  var label = container.insert(new Q.UI.Text({
	  	x: 0, y: 20, label: "S/. " + Math.round(stage.options.coins*100) / 100, color: "white" 
	  })); 
	});

	Q.scene('game', function(stage) {
		Q.stageTMX('map_quintus.tmx', stage); 
		stage.add('viewport');
		stage.centerOn(Q.tileSize * 18, Q.el.height / 2);

		Q.stageScene('hud', 2, { coins: 0 });
		var flor = stage.insert(new Q.Flower());
		flor.play('quieta');

		// Adding Gardener every X seconds
		function addGardener() {
			stage.insert(new Q.Gardener());
			setTimeout(addGardener, (Math.random()*2 + 1) * 1000 )
		}
		addGardener();
	});

	Q.scene('gameOver', function(stage) {

	});

	Q.scene('world', function(stage){
 
		stage.insert(new Q.UI.Button({
			asset: 'btn-start.png',
			x: Q.width/2,
			y: Q.height/2
		}, function() { 
			Q.stageScene("game");
		}));

	});


	Q.loadTMX(
		// World
		['map_quintus.tmx'
		// Images
		, 'jardineros.png', 'leafs.png','flor.png','coins.png', 'title.png', 'btn-start.png'
		// Audio
		, 'choque.ogg', 'coin.ogg', 'coin_pickup.ogg', 'jump.ogg', 'jump_gardener.ogg', 'leaf.ogg'
		// Data
		, 'jardineros.json', 'leafs.json', 'flor.json', 'coins.json']
		, function() {

			// Sheeting
			Q.compileSheets('flor.png', 'flor.json');
			Q.compileSheets('jardineros.png', 'jardineros.json');
	 		Q.compileSheets('leafs.png', 'leafs.json');
	 		Q.compileSheets('coins.png', 'coins.json');
	 
	        Q.stageScene('world');
	});
	

});