var ctx = c.getContext("2d");
var mapCtx = minimap.getContext("2d");
function canvasDebugger(contexts) {
	return contexts.map(_ => {
		var nativeBeginPath = _.beginPath.bind(_);
		var newBeginPath = (function() {
			this[1].watchDog = setTimeout(function() {console.log('Someone forgot to close path, fill or stroke')}, 200);
			this[0]();
		}).bind([nativeBeginPath, _]);
		_.beginPath = newBeginPath;
		function clearWatchDogTimer() {
			clearTimeout(this[1].watchDog);
			this[0]();
		}
		var nativeFill = _.fill.bind(_);
		var newFill = clearWatchDogTimer.bind([nativeFill,_]);
		_.fill = newFill;
		var nativeStroke = _.stroke.bind(_);
		var newStroke = clearWatchDogTimer.bind([nativeStroke,_]);
		_.stroke = newStroke;
		var nativeClosePath = _.closePath.bind(_);
		var newClosePath = clearWatchDogTimer.bind([nativeClosePath,_]);
		_.closePath = newClosePath;
	});
}
var log500Times;
(function() {
	var counter = 0;
	log500Times = function() {
		if (counter < 500) {
			console.log(arguments);
		}
		counter++;
	}
})()
var stats = new Stats();
stats.showPanel(1);
document.body.appendChild(stats.dom);
canvasDebugger([ctx, mapCtx]);
const MINI_MAP_SCALE = 8;
const OUTSIDE_THE_MAP = -1;
const NO_HIT = 0;
const IS_HIT = 1;
const X_HIT = 0;
const Y_HIT = 1;
const UP = 1;
const DOWN = -1;
const LEFT = -1;
const RIGHT = 1;
const TEXTURED_WALL = 10;
const COLORED_WALL = 11;
const SPRITE = 12;
const SORT_BY_DISTANCE = (a, b) => {return b.distance - a.distance};
function drawMiniMap() {
	if (minimap.width !== player.map.width * MINI_MAP_SCALE || minimap.height !== player.map.height * MINI_MAP_SCALE) {
		minimap.width = player.map.width * MINI_MAP_SCALE;
		minimap.height = player.map.height * MINI_MAP_SCALE;
	}
	mapCtx.fillStyle = "white";
	mapCtx.fillRect(0, 0, minimap.width, minimap.height);
	for (var y = 0; y < player.map.height; y++)
		for (var x = 0; x < player.map.width; x++)
			if (player.map.get(x, y) > 0) {
				mapCtx.fillStyle = "rgb(200, 200, 200)";
				mapCtx.fillRect(
					x * MINI_MAP_SCALE,
					y * MINI_MAP_SCALE,
					MINI_MAP_SCALE, MINI_MAP_SCALE
				);
			}
	updateMiniMap();
}
function updateMiniMap() {
	player.map.sprites.forEach(sprite => {
		mapCtx.fillStyle = "rgb(0, 200, 200)";
		mapCtx.fillRect(
			sprite.x * MINI_MAP_SCALE,
			sprite.z * MINI_MAP_SCALE,
			MINI_MAP_SCALE, MINI_MAP_SCALE
		);
		mapCtx.fillStyle = "black";
		mapCtx.fillRect(
			player.x * MINI_MAP_SCALE - 2,
			player.y * MINI_MAP_SCALE - 2,
			4, 4
		);
	});
	mapCtx.beginPath();
	mapCtx.moveTo(player.x * MINI_MAP_SCALE, player.y * MINI_MAP_SCALE);
	mapCtx.lineTo(
		(player.x + Math.cos(player.rot) * 4) * MINI_MAP_SCALE,
		(player.y + Math.sin(player.rot) * 4) * MINI_MAP_SCALE
	);
	mapCtx.stroke();
}
class Player {
	constructor() {
		this.x = 0;
		this.y = 0;
		this.dirX = 1
		this.dirY = 0; 
		this.planeX = 0;
		this.planeY = 0.66;
		this.dir = 0;
		this.rot = 0;
		this.speed = 0;
		this.moveSpeed = 0.4;
		this.rotSpeed = 6 * Math.PI / 180;
		this.map = null;
		return this;
	}
	move() {
		var moveStep = this.speed * this.moveSpeed;
		this.rot += this.dir * this.rotSpeed;
		var newX = this.x + Math.cos(player.rot) * moveStep;
		var newY = this.y + Math.sin(player.rot) * moveStep;
		var currentMapBlock = this.map.get(newX|0, newY|0);
		if (currentMapBlock === OUTSIDE_THE_MAP || currentMapBlock > 0) {
			this.stopMoving();
			return;
		}
		this.x = newX;
		this.y = newY;
		this.rotateDirectionAndPlane(this.dir * this.rotSpeed);
		return this;
	}
	rotateDirectionAndPlane(angle) {
		var oldDirX = this.dirX;
		this.dirX = this.dirX * Math.cos(angle) - this.dirY * Math.sin(angle);
		this.dirY = oldDirX * Math.sin(angle) + this.dirY * Math.cos(angle);
		var oldPlaneX = this.planeX;
		this.planeX = this.planeX * Math.cos(angle) - this.planeY * Math.sin(angle);
		this.planeY = oldPlaneX * Math.sin(angle) + this.planeY * Math.cos(angle);
		this.stopMoving();
	}
	setXY(x, y) {
		this.x = x;
		this.y = y;
		return this;
	}
	setRot(angle) {
		var difference = angle - this.rot;
		this.rot = angle;
		this.rotateDirectionAndPlane(difference);
		return this;
	}
	startMoving(direction) {
		switch (direction) {
			case "up":
				this.speed = UP; break;
			case "down":
				this.speed = DOWN; break;
			case "left":
				this.dir = LEFT; break;
			case "right":
				this.dir = RIGHT; break;
		}
		return this;
	}
	stopMoving() {
		this.speed = 0;
		this.dir = 0;
		return this;
	}
	castRays() {
		this.move();
		var visibleSprites = [];
		var zBuffer = [];
		var wallTypes = Object.keys(this.map.wallTypes);
		var numberOfWallTypes = wallTypes.length;
		for (var i = 0; i < numberOfWallTypes; i++) {
			var typeID = wallTypes[i];
			this.castRaysToSpecifiedWallType(this.map.wallTypes[typeID], zBuffer);
		}
		var sprites = this.map.sprites;
		var numberOfSprites = sprites.length;
		for (var i = 0; i < numberOfSprites; i++) {
			var sprite = sprites[i];
			var spriteX = sprite.x - this.x;
			var spriteY = sprite.z - this.y;
			var invDet = 1 / (this.planeX * this.dirY - this.dirX * this.planeY);
			var transformX = invDet * (this.dirY * spriteX - this.dirX * spriteY);
			var transformY = invDet * (-this.planeY * spriteX + this.planeX * spriteY);
			if (transformY > 0) {
				var spriteImage = sprite.texture;
				var texHeight = spriteImage.image.height;
				var texWidth = spriteImage.image.width;
				var spriteScreenX = (c.width / 2) * (1 + transformX / transformY);
				var spriteHeight = Math.abs(texHeight / transformY);
				var imaginedHeight = sprite.y * spriteHeight;
				var drawStartY = -imaginedHeight / 2 + c.height / 2 - imaginedHeight;
				var drawEndY = imaginedHeight / 2 + c.height / 2 - imaginedHeight;
				var spriteWidth = Math.abs(texWidth / transformY);
				var drawStartX = -spriteWidth / 2 + spriteScreenX;
				var drawEndX = spriteWidth / 2 + spriteScreenX;
				zBuffer.push({
					type: SPRITE,
					drawX: drawStartX,
					drawY: drawStartY,
					texture: spriteImage,
					width: spriteWidth,
					height: spriteHeight,
					distance: transformY
				});
			}
		}
		return zBuffer.sort(SORT_BY_DISTANCE);
	}
	castRaysToSpecifiedWallType(wallType, zBuffer) {
		for (var x = 0; x < c.width; x++) {
			var cameraX = 2 * x / c.width - 1;
			var rayPosX = this.x;
			var rayPosY = this.y;
			var rayDirX = this.dirX + this.planeX * cameraX;
			var rayDirY = this.dirY + this.planeY * cameraX;
			var mapX = rayPosX | 0;
			var mapY = rayPosY | 0;
			var deltaDistX = Math.sqrt(1 + (rayDirY * rayDirY) / (rayDirX * rayDirX));
			var deltaDistY = Math.sqrt(1 + (rayDirX * rayDirX) / (rayDirY * rayDirY));
			var stepX = 0;
			var stepY = 0;
			var sideDistX = 0;
			var sideDistY = 0;
			var wallDistance = 0;
			var giveUp = false;
			if (rayDirX < 0) {
				stepX = -1;
				sideDistX = (rayPosX - mapX) * deltaDistX;
			} else {
				stepX = 1;
				sideDistX = (mapX + 1 - rayPosX) * deltaDistX;
			}
			if (rayDirY < 0) {
				stepY = -1;
				sideDistY = (rayPosY - mapY) * deltaDistY;
			} else {
				stepY = 1;
				sideDistY = (mapY + 1 - rayPosY) * deltaDistY;
			}
			var hit = NO_HIT;
			var side = X_HIT;
			while (hit === NO_HIT) {
				if (sideDistX < sideDistY) {
					sideDistX += deltaDistX;
					mapX += stepX;
					side = X_HIT;
				} else {
					sideDistY += deltaDistY;
					mapY += stepY;
					side = Y_HIT;	
				}
				var currentMapBlock = this.map.get(mapX, mapY);
				if (currentMapBlock === OUTSIDE_THE_MAP || this.map.wallTypes[currentMapBlock] === wallType) {
					hit = IS_HIT;
					if (currentMapBlock === OUTSIDE_THE_MAP) {
						giveUp = true;
					}
				}
			}
			if (giveUp) {continue;}
			if (side === X_HIT) {
				wallDistance = (mapX - rayPosX + (1 - stepX) / 2) / rayDirX;
			} else {
				wallDistance = (mapY - rayPosY + (1 - stepY) / 2) / rayDirY;
			}
			var color = wallType.color;
			var wallHeight = wallType.height;
			var lineHeight = c.height / wallDistance;
			var drawEnd = lineHeight / 2 + c.height / 2;
			lineHeight *= wallHeight < 0 ? 0 : wallHeight;
			var drawStart = drawEnd - lineHeight;
			var exactHitPositionX = rayPosY + wallDistance * rayDirY;
			var exactHitPositionY = rayPosX + wallDistance * rayDirX;
			if (side === X_HIT) {
				var wallX = exactHitPositionX;
			} else {
				var wallX = exactHitPositionY;
			}
			var currentBuffer = {};
			zBuffer.push(currentBuffer);
			currentBuffer.side = side;
			currentBuffer.start = drawStart;
			currentBuffer.end = drawEnd;
			currentBuffer.x = x; 
			currentBuffer.distance = wallDistance;
			if (color instanceof Texture) {
				currentBuffer.type = TEXTURED_WALL;
				var texture = color;
				currentBuffer.texture = texture;
				wallX -= wallX | 0;
				var textureX = wallX * texture.image.width;
				if ((side === X_HIT && rayDirX > 0) || (side === Y_HIT && rayDirY < 0)) {
					textureX = texture.image.width - textureX - 1;
				}
				currentBuffer.textureX = textureX;
			} else {
				currentBuffer.type = COLORED_WALL;
				currentBuffer.color = color;
			}
		}
	}
	render(zBuffer) {
		var bufferLength = zBuffer.length;
		for (var i = 0; i < bufferLength; i++) {
			var currentBuffer = zBuffer[i];
			var side = currentBuffer.side;
			var drawStart = currentBuffer.start;
			var drawEnd = currentBuffer.end;
			var {
				side,
				texture,
				textureX,
				color,
				x,
				drawX,
				drawY,
				width,
				height,
				start: drawStart,
				end: drawEnd
			} = currentBuffer;
			var lineHeight = drawEnd - drawStart;
			if (currentBuffer.type === TEXTURED_WALL) {
				ctx.globalAlpha = 1;
				ctx.fillStyle = "black";
				ctx.fillRect(x, drawStart, 1, lineHeight);
				if (side === Y_HIT) {
					ctx.globalAlpha = .7;
				} else {
					ctx.globalAlpha = 1;
				}
				ctx.drawImage(texture.image, textureX, 0, 1, texture.image.height, x, drawStart, 1, lineHeight);
			} else if (currentBuffer.type === COLORED_WALL) {
				ctx.globalAlpha = 1;
				ctx.fillStyle = "black";
				ctx.fillRect(x, drawStart, 1, lineHeight);
				if (side === Y_HIT) {
					ctx.globalAlpha = .7;
				} else {
					ctx.globalAlpha = 1;
				}
				ctx.fillStyle = "rgb("+color[0]+", "+color[1]+", "+color[2]+")";
				ctx.fillRect(x, drawStart, 1, lineHeight);
			} else if (currentBuffer.type === SPRITE) {
				ctx.globalAlpha = 1;
				ctx.drawImage(texture.image, drawX | 0, drawY | 0, width | 0, height | 0);
			}
		}

	}
}
class Grid {
	constructor(wallGrid, wallTextures, sprites) {
		this.wallGrid = wallGrid;
		this.height = wallGrid.length;
		this.width = this.height === 0 ? 0 : wallGrid[0].length;
		this.wallTypes = wallTextures || {};
		this.sprites = sprites || [];
		return this;
	}
	get(x, y) {
		x = x | 0;
		y = y | 0;
		var currentMapBlock = this.wallGrid[y];
		if (currentMapBlock === undefined) return OUTSIDE_THE_MAP;
		currentMapBlock = currentMapBlock[x];
		if (currentMapBlock === undefined) return OUTSIDE_THE_MAP;
		return currentMapBlock;
	}

}
class Texture {
	constructor(src, width, height) {
		this.image = new Image();
		this.image.src = src;
		if (width && height) {
			this.image.width = width;
			this.image.height = height;
		}
	}
}
class Sprite {
	constructor(texture, x, y, z) {
		this.texture = texture;
		this.x = x;
		this.y = y;
		this.z = z;
	}
}

class Wall {
	constructor(height, color) {
		this.height = height;
		this.color = color;
	}
}
var player = new Player();
player.x = player.y = 3;
player.map = new Grid([
	[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
	[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
	[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
	[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
	[1,0,0,0,0,0,1,1,1,1,1,0,0,0,0,1,0,1,0,1,0,0,0,1],
	[1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
	[1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,1,0,0,0,1],
	[1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
	[1,0,0,0,0,0,1,1,2,1,1,0,0,0,0,1,0,1,0,1,0,0,0,1],
	[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
	[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
	[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
	[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
	[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
	[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
	[1,0,0,0,0,0,0,0,0,0,0,0,0,0,2,1,0,0,0,0,0,0,0,1],
	[1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
	[1,1,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
	[1,1,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
	[1,1,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
	[1,1,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
	[1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
	[1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
	[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
], {'1': new Wall(2, new Texture('walls.png')), '2': new Wall(4, [255, 0, 0]) }, [new Sprite(new Texture('walls.png', 100, 100), 4, 1, 4)]);
var keyCodes = {
	"38": "up",
	"40": "down",
	"37": "left",
	"39": "right"
}
document.addEventListener("keydown", function(e) {
	player.startMoving(keyCodes[e.keyCode]);
});
document.addEventListener("keyup", function(e) {
	player.stopMoving();
});
var isDragging = false;
c.addEventListener("mousedown", startDragging);
window.addEventListener("mouseup", endDragging);
c.addEventListener("touchstart", startDragging);
c.addEventListener("touchend", endDragging);
c.addEventListener("mousemove", whileDragging);
c.addEventListener("touchmove", whileDragging);
var mouseX = 0;
var pmouseX = 0;
var mouseY = 0;
var pmouseY = 0;
function whileDragging(e) {
	var event;
	e.preventDefault();
	if (e.touches) {
		event = e.touches[0];
	} else {
		event = e;
	}
	pmouseX = mouseX;
	pmouseY = mouseY;
	mouseX = event.pageX - c.offsetLeft;
	mouseY = event.pageY - c.offsetTop;
	if (isDragging) {
		player.setRot(player.rot + (mouseX - pmouseX) / c.width * 2);
		var moveDistance = -(mouseY - pmouseY) / c.height * 15;
		var fractionalPart = moveDistance % 1;
		var integerPart = moveDistance | 0;
		player.speed = integerPart < 0 ? DOWN : UP;
		for (var i = 0; i < Math.abs(integerPart); i++) {
			var result = player.move();
			if (!result) {
				return;
			}
		}
		player.speed = fractionalPart;
		player.move();
	}
}
function startDragging(e) {
	var event;
	e.preventDefault();
	if (e.touches) {
		event = e.touches[0];
	} else {
		event = e;
	}
	mouseX = event.pageX - c.offsetLeft;
	mouseY = event.pageY - c.offsetTop;
	isDragging = true;
}
function endDragging(e) {
	e.preventDefault();
	isDragging = false;
}
function renderLoop() {
	ctx.clearRect(0, 0, c.width, c.height);
	player.render(player.castRays());
	drawMiniMap();
}
requestAnimationFrame(function animate() {
	stats.begin();
	if (c.clientWidth !== c.width || c.clientHeight !== c.height) {
		c.width = c.clientWidth;
		c.height = c.clientHeight;
	}
	renderLoop();
	stats.end();
	stats.update();
	requestAnimationFrame(animate);
});
