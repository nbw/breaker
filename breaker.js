var DEFAULT_BALL_SPEED = 2,
	DEFAULT_BALL_SIZE = 9,
 	DEFAULT_BALL_ANGLE = -90,
 	DEFAULT_PADDLE_SPEED = 6,
 	DEFAULT_PADDLE_WIDTH = 100;
 	FPS = 120;

var BreakerVM = function(container){
	var self = this;

	var startX = container.width()/2,
		startY = container.height()-25;

	var borderLeft = 0, 
		borderRight = container.width(), 
		borderTop = 0, 
		borderBottom = container.height();

	self.paddle = new Paddle(startX,startY);
	self.ball = new Ball(startX,startY-50);
	self.breakerText = ko.observable("Want to play a game?");
	self.hideText = ko.observable(false);
	self.showGame = ko.observable(false);
	self.blocks = [];

	self.powerUps = [
		{
			message: 'speed!',
		 	f: function(){
		 		self.ball.speed = self.ball.speed*1.6;
		 	}
		},
		{
			message: 'slow down dude..',
		 	f: function(){
		 		self.ball.speed = self.ball.speed*0.625;
		 	}
		},
		{
			message: 'bigger pad :)',
		 	f: function(){
		 		self.paddle.paddleWidth(self.paddle.paddleWidth()+50);
		 	}
		},
		{
			message: 'smaller pad - sorry!',
		 	f: function(){
		 		self.paddle.paddleWidth(self.paddle.paddleWidth()-30);
		 	}
		},
		{
			message: 'big ball :D',
		 	f: function(){ 
		 		var ballSize = self.ball.size();
		 		self.ball.size((ballSize < DEFAULT_BALL_SIZE)?DEFAULT_BALL_SIZE:ballSize*1.5);
		 	}
		},
		{
			message: 'small ball - oops',
		 	f: function(){
		 		self.ball.size(6);
		 	}
		}
	]; 
	//initialize keys
	self.keys = {};
	$(document).keydown(function(event){
	    self.keys[event.which] = true;
	  }).keyup(function(event){
	    delete self.keys[event.which];
	});

	self.start = function(){
		breaker.init();
		self.hideText(true); 
		setTimeout(function(){
			self.startSequence(3);
			setInterval(function() {self.run();}, 1000/FPS);
		},3000);
	},
	self.init = function(){
		self.blocks = self.getBlocks();
		self.showGame(true);
	},
	self.reset = function(){
		self.ball.reset();
		self.paddle.reset();
		self.startSequence(3);
	},
	self.stop = function(){
		self.ball.stop();
	},
	self.startSequence = function(secs){
		self.hideText(false);
		self.breakerText("...");
		var second = secs;
		var countdown = setInterval(function(){
			if(second === 0 ){
				self.hideText(true);
				self.ball.start();
				clearInterval(countdown);
			}
			else{
				self.breakerText(second + "..");
				second -= 1;
			}
		},1000);
	},
	self.collisionCheck = function(){
		self.hitWallCheck();
		self.hitBlockCheck();
		self.hitPaddleCheck();
	},
	self.draw = function(){
		self.drawPaddle();
		self.ball.move();
	},
	self.drawPaddle = function(){
		if(self.keys[37] && self.paddle.left() > 0){
			self.paddle.moveLeft();
			return;
		}
		if(self.keys[39] && self.paddle.right() < borderRight){
			self.paddle.moveRight();
			return;
		}
		else if(self.paddle.moving){
			self.paddle.moving = false;
		}
	},
	self.run = function(){
		self.collisionCheck();
		self.draw();
	},
	self.hitWallCheck = function(){
		//side walls
		if(self.ball.pos.x() < borderLeft || self.ball.pos.x()+self.ball.size() > borderRight){
			self.ball.reflectSide();
		}
		//top wall
		if(self.ball.pos.y() < borderTop ){
			self.ball.reflectTopBottom();
		}
		//bottom wall
		if(self.ball.pos.y()+self.ball.size() > borderBottom || self.ball.pos.y() < borderTop){
			self.reset();
		}
	},
	self.hitPaddleCheck = function(){
		var ball_bottom = (self.ball.size() + self.ball.pos.y());
		if( ((self.paddle.pos.y() - ball_bottom) <= self.ball.speed*Math.abs(Math.sin(self.ball.angle*Math.PI/180))) && (ball_bottom <= self.paddle.pos.y())){
			if( (self.ball.pos.x()+self.ball.size() >= self.paddle.left()) && (self.ball.pos.x() <= self.paddle.right()) ){
				self.paddleReflection();
				self.paddleFriction();
				self.ball.reflectTopBottom();
			}
		}
	},
	self.paddleReflection = function(){ // reflection from where it hits on the paddle
		var ballX = 2*(self.ball.pos.x()-self.paddle.left()-self.paddle.paddleWidth()/2)/self.paddle.paddleWidth();
		self.ball.angle += 20*Math.exp(3*(Math.abs(ballX)-1))*((ballX>0)?1:-1);
	},
	self.paddleFriction = function(){ // reflection based on if the paddle is moving
		switch(self.paddle.moving){
			case 'left':
				self.ball.angle = self.ball.angle + 20 + 2.5*Math.random();
				break;
			case 'right':
				self.ball.angle = self.ball.angle - 20 + 2.5*Math.random();
				break;
			default:
		}
	},
	self.hitBlockCheck = function(){
		var ball_x = self.ball.pos.x(),
			ball_dx =  Math.cos(self.ball.angle*Math.PI/180)*self.ball.speed,
			ball_y = self.ball.pos.y(),
			ball_dy =  -1*Math.sin(self.ball.angle*Math.PI/180)*self.ball.speed,
			ball_size = self.ball.size(),
			hasHit = false;
		for(var i = 0; i < self.blocks.length; i++){
			hasHit = self.hasHit(self.blocks[i], ball_x, ball_dx, ball_y, ball_dy,ball_size);
			if(hasHit === "hitSide" || hasHit === "hitTopBottom"){
				switch (hasHit){
				case "hitSide":
					self.ball.reflectSide();
					break;
				case "hitTopBottom":
					self.ball.reflectTopBottom();
					break;
				}
				var block = self.blocks.splice(i,1);
				$(block[0].html).addClass('dead');
				if(self.blocks.length === 0){
					self.winCondition();
				}
				if($(block[0].html).hasClass('powerup')){
					self.powerupTime();
				}			
			}
		}
	},
	self.hasHit = function(block, ball_x,ball_dx,ball_y,ball_dy,ball_size){
		if(self.hasHit2(block,ball_x,ball_y,ball_size)){
			// I've always wanted a programming excuse to use calculus - yay. existence gratified
			var b = ((ball_dy<0)?(ball_y+ball_size):ball_y) - (ball_dy/ball_dx)*((ball_dx>0)?(ball_x+ball_size):ball_x);
			var y =  (ball_dy/ball_dx)*((ball_dx>0)?block.left:block.right) + b;
			
			if( (y < block.top) || (y > block.bottom) ){
				return "hitTopBottom";
			}				
			return "hitSide";
		}
		else{
			return false;
		}
	},
	self.hasHit2 = function(block,ball_x,ball_y,ball_size){
		if((ball_y+ball_size>=block.top)&&(ball_y<=block.bottom)&&(ball_x+ball_size>=block.left)&&(ball_x<=block.right)){
			return true;
		}
		else{
			return false;
		}
	},
	self.getBlocks = function(){// Building Blocks Array
		var els = $(".brick");
		var blocks = [];
		for( var i = 0	; i < els.length; i++){
			blocks.push(new Block(els[i]));
		}
		return blocks;
	},
	self.powerupTime = function(){// Select Random Powerup
		var select = Math.floor(Math.random()*self.powerUps.length);
		self.breakerText(self.powerUps[select].message);
		self.hideText(false);
		setTimeout(function(){
			self.hideText(true);
			self.powerUps[select].f();
		},2000);
	},
	self.winCondition = function(){
		alert("You win! I'm not sure what you win yet though... oops.");
	};
};
var Ball = function(_startX,_startY) {
	var self = this;
	self.pos = new Point(_startX,_startY);
	self.speed = DEFAULT_BALL_SPEED;
	self.angle = DEFAULT_BALL_ANGLE;
	self.size = ko.observable(DEFAULT_BALL_SIZE);
	self.moveEnabled = false;

	self.move = function(){
		if(self.moveEnabled){
			var dy = -1*Math.sin(self.angle*Math.PI/180)*self.speed,
				dx = Math.cos(self.angle*Math.PI/180)*self.speed;
			self.pos.moveVertical(dy); 
			self.pos.moveHorizontal(dx);
		}
	};
	self.reset = function(){
		self.stop();
		self.pos.x(_startX);
		self.pos.y(_startY);
		self.size(DEFAULT_BALL_SIZE);
		self.speed = DEFAULT_BALL_SPEED;
		self.angle = DEFAULT_BALL_ANGLE;
	},
	self.start = function(){
		self.moveEnabled = true;
	},
	self.stop = function(){
		self.moveEnabled = false;
	},
	self.reflectTopBottom = function(){
		self.angle *= -1;
	},
	self.reflectSide = function(){
		self.angle = -1*(180 + self.angle);
	};
};
 
var Paddle = function(_startX,_startY) {
	var self = this;
	self.pos = new Point(_startX-DEFAULT_PADDLE_WIDTH/2,_startY);
	self.paddleWidth = ko.observable(DEFAULT_PADDLE_WIDTH);
	self.left = ko.computed(function(){
		return self.pos.x();
	});
	self.right = ko.computed(function(){
		return self.pos.x() + self.paddleWidth();
	});

	self.moving = false;
	self.hSensitivity = DEFAULT_PADDLE_SPEED;
		
	self.moveLeft = function(){
		self.pos.moveHorizontal(-1*self.hSensitivity);
		self.moving = 'left';
	},
	self.moveRight = function(){
		self.pos.moveHorizontal(self.hSensitivity);
		self.moving = 'right';
	};
	self.reset = function(){
		self.paddleWidth(DEFAULT_PADDLE_WIDTH);
	}
};

var Point = function(_x,_y){
	var self = this;
	self.x = ko.observable(_x);
	self.y = ko.observable(_y);
	self.moveVertical = function(dy){
		self.y(self.y() + dy);
	},
	self.moveHorizontal = function(dx){
		self.x(self.x() + dx);
	};
};

var Block = function(_html, _containerOffsetX, _containerOffsetY){
	var self = this;
	self.html = _html;
	self.left = self.html.offsetLeft,
	self.top = self.html.offsetTop,
	self.bottom = self.top + self.html.offsetHeight,
	self.right = self.left + self.html.offsetWidth;
};
$(document).ready(function(){
	// creates the bricks for the game
	brickMode = function(_containerTag){
		var elements = [ 'h1', 'h2', 'h3', 'p'];
		var buzzWords = [	'Bandcamp',
							'Fans','fans','Fan','fan',
							'Artists','artists','Artist','artist',
							'Labels','labels','Label','label',
							'Albums','albums','Album','album',
							'Tracks','tracks','Track','track',
							'Subscribers','subscribers','Subscriber','subscriber',
							'Music','music'
						];
		[ 'h1', 'h2', 'h3', 'p'].forEach(function(elementType){
			$(_containerTag+" " + elementType).toArray().forEach(function(el){
				var words = $(el).text().split(/\s+/),
					str = "";
				for(var i = 0; i < words.length; i++){
					var mySpan = $("<span></span>");
					mySpan.addClass('brick');
					mySpan.text(words[i]);  
					if(buzzWords.indexOf(words[i]) >= 0){
						mySpan.addClass('powerup');
						mySpan.attr('data-bind',"css: { 'active' : showGame }");
					}
					str += mySpan.prop('outerHTML') + " ";
				} 
				$(el).html(str);
				$(el).addClass('brickGroup');
				$(el).attr('data-bind',"css: { 'active' : showGame }");
			});
		});
	};

	var containerTag = "#docs-content .subject-content";
	brickMode(containerTag);
	breaker = new BreakerVM($(containerTag));
	ko.applyBindings(breaker,$('#docs-content')[0]);
});
