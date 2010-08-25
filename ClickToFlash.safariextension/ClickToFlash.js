function ClickToFlash() {
	this.elementMapping = new Array();
	this.videoElementMapping = new Array();
	
	this.killers = [];
	
	this.settings = null;
	
	var _this = this;	
	this.respondToMessage = function(event) {
		if (event.name == "getSettings") {
			_this.getSettings(event);
		}
	};
	
	this.handleBeforeLoadEventTrampoline = function(event) {
		_this.handleBeforeLoadEvent(event);
	};
	
	safari.self.addEventListener("message", this.respondToMessage, false);
	document.addEventListener("beforeload", this.handleBeforeLoadEventTrampoline, true);
}

ClickToFlash.prototype.handleBeforeLoadEvent = function(event) {
	const element = event.target;
	
	if (element instanceof HTMLEmbedElement || element instanceof HTMLObjectElement) {
		if (element.allowedToLoad)
			return;
			
		if (element instanceof HTMLObjectElement) {
			var type = element.getAttribute("type");
			if (!type) {
				var embeds = element.getElementsByTagName("embed");
				if (embeds.length) {
					type = embeds[0].getAttribute("type");
				}
			}
			if (!type) {
				return;
			}
			
			if (!type.match("application/x-shockwave-flash") && !type.match("application/futuresplash")) {
				return;
			}
		}
		
		this.settings = safari.self.tab.canLoad(event, "getSettings");
		this.settings["whitelist"] = this.settings["whitelist"].split(",");
			
		// Deal with sIFR first
		if (this.isSIFRText(element)) {
			var autoloadSIFR = this.settings["sifrReplacement"];
			if (this.settings["sifrReplacement"] == "autoload") {
				element.allowedToLoad = true;
				return;
			}
		}
		
		// This is hacky, but it's an easy way to convert the possibly-relative
		// src URL into an absolute one
		var tempAnchor = document.createElement("a");
		tempAnchor.href = element.src;
		element.src = tempAnchor.href;
		tempAnchor = null;
		
		// Check if the element matches anything on the whitelist
		for (i = 0; i < this.settings["whitelist"].length; i++) {
			var currentWhitelistItem = this.settings["whitelist"][i];
			if (currentWhitelistItem.length && (element.src.match(currentWhitelistItem) || location.href.match(currentWhitelistItem))) {
				element.allowedToLoad = true;
				return;
			}
		}
			
		element.elementID = this.elementMapping.length;	
		event.preventDefault();
		this.processFlashElement(element);
	}
};

ClickToFlash.prototype.openWhitelist = function() {
	var bg = document.createElement("div");
	bg.id = "whitelistBackground";
	var origThis = this;
	bg.onclick = function(event) {
		if (event.target === bg) {
			origThis.closeWhitelist();
		}
	};
	
	var container = document.createElement("div");
	container.id = "whitelistContainer";
	bg.appendChild(container);
	document.body.appendChild(bg);
	
	var mainHeader = document.createElement("h1");
	mainHeader.textContent = "ClickToFlash";
	container.appendChild(mainHeader);
	
	var subHeader = document.createElement("h2");
	subHeader.textContent = "Site Whitelist";
	container.appendChild(subHeader);
	
	var listBox = document.createElement("ul");
	listBox.id = "whitelistSites";
	container.appendChild(listBox);
	
	var buttonBar = document.createElement("div");
	buttonBar.id = "buttonBar";
	container.appendChild(buttonBar);
	
	var addButton = document.createElement("button");
	addButton.id = "addWhitelistButton";
	addButton.textContent = "+";
	buttonBar.appendChild(addButton);
	
	var removeButton = document.createElement("button");
	removeButton.id = "removeWhitelistButton";
	removeButton.textContent = "\u2013";
	removeButton.disabled = true;
	buttonBar.appendChild(removeButton);
	
	var bottomButtons = document.createElement("div");
	bottomButtons.id = "whitelistBottomButtons";
	container.appendChild(bottomButtons);
	
	var cancelButton = document.createElement("button");
	cancelButton.setAttribute("type", "button");
	cancelButton.id = "cancelButton";
	cancelButton.textContent = "Cancel";
	cancelButton.onclick = function(event){origThis.closeWhitelist();};
	bottomButtons.appendChild(cancelButton);
	
	var saveButton = document.createElement("button");
	saveButton.setAttribute("type", "button");
	saveButton.id = "saveButton";
	saveButton.textContent = "Save";
	saveButton.onclick = function(event){
		var whitelistSites = [], whitelistSite;
		for (i = 0; i < listBox.childNodes.length; i++) {
			whitelistSite = listBox.childNodes[i].textContent.replace(/\s/g, "");
			if (whitelistSite) {
				whitelistSites[whitelistSites.length] = whitelistSite;
			};
		}
		
		var newWhitelistString = whitelistSites.join(",");
		safari.self.tab.dispatchMessage("setWhitelist", newWhitelistString);
		origThis.settings["whitelist"] = whitelistSites;
		
		origThis.closeWhitelist();
	};
	bottomButtons.appendChild(saveButton);

	var selectedListItem = null;
	
	function selectListItem(li){
		if (selectedListItem) {
			selectedListItem.blur();
			selectedListItem.className = "";
		}
		if (li) {
			li.className = "selected";
			removeButton.disabled = false;
		} else {
			removeButton.disabled = true;
		}
		selectedListItem = li;
	}

	function startEditing(){
		selectedListItem.setAttribute('contenteditable', 'plaintext-only');
		selectedListItem.focus();
		selectedListItem.editing = true;
	}
	function endEditing(){
		selectedListItem.removeAttribute('contenteditable');
		delete selectedListItem.editing;
		selectedListItem.blur();
	}
	function removeSelectedListItem(){
		var listItem = selectedListItem;
		selectListItem(listItem.nextElementSibling || listItem.previousElementSibling || null);
		listBox.removeChild(listItem);
	}
	function addListItem(text, select){
		var newListItem = document.createElement("li");
		listBox.appendChild(newListItem);
		if (text) {
			newListItem.textContent = text;
		}
		if (select) {
			selectListItem(newListItem);
			startEditing();
		}
	}
	var keyboardListener;
	document.addEventListener("keydown", (keyboardListener = function(e){
		var next;
		if ((e.keyCode === 38 && !(selectedListItem && selectedListItem.editing)) || (e.keyCode === 9 && e.shiftKey && !e.ctrlKey)) { // Up arrow/shift+tab
			if (selectedListItem) { 
				if ((next = selectedListItem.previousElementSibling)) {
					selectListItem(next);
				}
			} else {
				selectListItem(listBox.lastElementChild);
			}
		} else if ((e.keyCode === 40 && !(selectedListItem && selectedListItem.editing)) || (e.keyCode === 9 && !e.ctrlKey)){ // Down arrow/tab
			if (selectedListItem) { 
				if ((next = selectedListItem.nextElementSibling)) {
					selectListItem(next);
				}
			} else {
				selectListItem(listBox.firstElementChild);
			}
		} else if (e.keyCode === 13){ // Enter
			if (selectedListItem) {
				if (selectedListItem.editing) {
					endEditing();
				} else {
					startEditing();
				}
			}
		} else if (e.keyCode === 27){ // Escape
			if (selectedListItem && selectedListItem.editing) {
				endEditing();
			};
		} else {
			return;
		}
		e.preventDefault();
	}));
	listBox.addEventListener("mousedown", function(e){
		if(e.target.nodeName === "LI"){
			if (e.target !== selectedListItem) {
				selectListItem(e.target);
			}
		} else {
			selectListItem(null);
		}
	});
	listBox.addEventListener("dblclick", function(e){
		if(e.target.nodeName === "LI" && selectedListItem && selectedListItem.contentEditable === "false"){
			startEditing();
		}
	});
	listBox.addEventListener("focusout", function(){
		endEditing();
	});
	addButton.addEventListener("click", function(){
		addListItem(null, true);
	});
	removeButton.addEventListener("click", removeSelectedListItem);
	
	this.settings.whitelist.forEach(function(item){
		if (item.length) {
			addListItem(item);
		};
	});
	
	setTimeout(function(){
		bg.className = "visible"; 
	}, 10);
	
	this.whitelistEditor = { container: bg, cleanUp: function(){
		document.removeEventListener("keydown", keyboardListener);
	} };
};

ClickToFlash.prototype.closeWhitelist = function() {
	if (this.whitelistEditor) {
		this.whitelistEditor.cleanUp();
		
		var container = this.whitelistEditor.container;
		container.className = "";
		container.addEventListener('webkitTransitionEnd', function(e){
			if (e.target === container) {
				document.body.removeChild(container);
			}
		});
		this.whitelistEditor = null;
	}
};

ClickToFlash.prototype.openActionMenu = function(event) {
	// Get the element
	var placeholderElement = event.target;
	while (placeholderElement && placeholderElement.className != "clickToFlashPlaceholder") {
		placeholderElement = placeholderElement.parentNode;
	}
	
	// Just in case
	if (!placeholderElement) {
		placeholderElement = event.target;
	} else {
		// Get the container
		for (i = 0; i < placeholderElement.childNodes.length; i++) {
			var currentNode = placeholderElement.childNodes[i];
			if (currentNode.className == "clickToFlashPlaceholderContainer") {
				placeholderElement = currentNode;
				break;
			}
		}
	}
	
	this.openContextMenu(placeholderElement, "18px", "18px");
};

ClickToFlash.prototype.openContextMenu = function(placeholderElement, left, top) {
	// placeholderElement is the clickToFlashPlaceholderContainer
	var elementID = parseInt(placeholderElement.parentNode.id.replace("ClickToFlashPlaceholder", ""));
	
	var origThis = this;
	
	var menuElement = document.createElement("menu");
	menuElement.className = "contextMenu";
	menuElement.id = "actionMenu";
	menuElement.style.left = left;
	menuElement.style.top = top;
	
	var loadFlashElement = document.createElement("li");
	loadFlashElement.className = "menuItem";
	loadFlashElement.textContent = "Load Flash";
	loadFlashElement.id = "loadFlashMenuItem";
	loadFlashElement.onclick = function(event){origThis.loadFlashForElement(placeholderElement.parentNode);};
	menuElement.appendChild(loadFlashElement);
	
	if (this.videoElementMapping[elementID]) {
		var loadH264Element = document.createElement("li");
		loadH264Element.className = "menuItem";
		loadH264Element.textContent = "Load in QuickTime";
		loadH264Element.id = "loadQuicktimeMenuItem";
		loadH264Element.onclick = function(event){origThis.loadH264ForElement(placeholderElement.parentNode);};
		menuElement.appendChild(loadH264Element);
	}
	
	var sepElement = document.createElement("li");
	sepElement.className = "separator";
	menuElement.appendChild(sepElement);

	var openWhitelistElement = document.createElement("li");
	openWhitelistElement.className = "menuItem";
	openWhitelistElement.textContent = "Edit Whitelist...";
	openWhitelistElement.onclick = function(event){origThis.openWhitelist();};
	menuElement.appendChild(openWhitelistElement);
	
	placeholderElement.appendChild(menuElement);
	
	var closeMenuClickHandler = function(event) {
		document.getElementsByTagName("body")[0].removeEventListener("mousedown", closeMenuClickHandler, false);
		menuElement.style.opacity = "0 !important";
		menuElement.addEventListener("webkitTransitionEnd", function() {
			placeholderElement.removeChild(menuElement);
		});
	};
	document.getElementsByTagName("body")[0].addEventListener("mousedown", closeMenuClickHandler, false);
};

ClickToFlash.prototype.loadFlashForElement = function(placeholderElement) {
	var elementID = parseInt(placeholderElement.id.replace("ClickToFlashPlaceholder", ""));
	var element = this.elementMapping[elementID];
	element.allowedToLoad = true;
	placeholderElement.parentNode.replaceChild(element, placeholderElement);
};

ClickToFlash.prototype.loadH264ForElement = function(placeholderElement) {
	var elementID = parseInt(placeholderElement.id.replace("ClickToFlashPlaceholder", ""));
	var videoURL = this.videoElementMapping[elementID];
	
	var flashElement = this.elementMapping[elementID];
	var flashvars = flashElement.getAttribute("flashvars");
	
	// Create the video element
	var videoElement = document.createElement("video");
	videoElement.src = videoURL;
	videoElement.setAttribute("controls", "controls");
	if (getFlashVariable(flashvars, "autoplay") == "1") {
		videoElement.setAttribute("autoplay", "autoplay");
	}
	videoElement.style = placeholderElement.style;
	videoElement.style.width = placeholderElement.style.width;
	videoElement.style.height = placeholderElement.style.height;
	placeholderElement.parentNode.replaceChild(videoElement, placeholderElement);
};

ClickToFlash.prototype.clickPlaceholder = function(event) {
	var clickedElement = event.target;
	
	if (clickedElement.className == "actionButton" || clickedElement.className == "contextMenu" || clickedElement.className == "menuItem") {
		return;
	}
	
	while (clickedElement.className != "clickToFlashPlaceholder") {
		clickedElement = clickedElement.parentNode;
	}
	
	var elementID = parseInt(clickedElement.id.replace("ClickToFlashPlaceholder", ""));

	var element = this.videoElementMapping[elementID];
	if (!element) {
		this.loadFlashForElement(clickedElement);
	} else {
		this.loadH264ForElement(clickedElement);
	}
};

ClickToFlash.prototype.isSIFRText = function(element) {
	return (element.className == "sIFR-flash" || element.getAttribute("sifr"));
};

ClickToFlash.prototype.processFlashElement = function(element) {
	// Check if it's already in the mapping dictionary
	// If so, the user must have clicked it already
	if (this.elementMapping[element.elementID]) {
		return;
	}

	var placeholderElement = document.createElement("div");
	placeholderElement.style = element.style;
	placeholderElement.style.width = element.offsetWidth + "px";
	placeholderElement.style.height = element.offsetHeight + "px";
	placeholderElement.className = "clickToFlashPlaceholder";
	
	var id = element.elementID;
	this.elementMapping[id] = element;
	placeholderElement.id = "ClickToFlashPlaceholder" + id;

	var didClickAndHold = false;
	var clickHandler = this;
	placeholderElement.onclick = function(event){if (!didClickAndHold) {clickHandler.clickPlaceholder(event)}};
	placeholderElement.oncontextmenu = function(event){
		var left = event.offsetX;
		var top = event.offsetY;
		var clickedElement = event.target;
		while (clickedElement.className != "clickToFlashPlaceholderContainer") {
			left += clickedElement.offsetLeft;
			top += clickedElement.offsetTop;
			clickedElement = clickedElement.parentNode;
		}
		
		clickHandler.openContextMenu(clickedElement, left + "px", top + "px"); 
		return false;
	};

	if (element.parentNode) {
		// Wait 5ms before replacing the element. If we don't, the following
		// WebKit bug will cause CTF to crash on certain sites:
		//     https://bugs.webkit.org/show_bug.cgi?id=41054
		// This was fixed on June 23, 2010, but it's unlikely to show up
		// in a release version of Safari for a while. Until then,
		// this workaround seems to work.
		setTimeout(function(){element.parentNode.replaceChild(placeholderElement, element);}, 5);
	}
	
	var container = document.createElement("div");
	container.className = "clickToFlashPlaceholderContainer";
	placeholderElement.appendChild(container);
	
	var verticalPositionElement = document.createElement("div");
	verticalPositionElement.className = "logoVerticalPosition";
	container.appendChild(verticalPositionElement);

	var horizontalPositionElement = document.createElement("div");
	horizontalPositionElement.className = "logoHorizontalPosition";
	verticalPositionElement.appendChild(horizontalPositionElement);

	var logoContainer = document.createElement("div");
	logoContainer.className = "logoContainer";
	horizontalPositionElement.appendChild(logoContainer);
	
	var logoElement = document.createElement("div");
	logoElement.textContent = "Flash";
	logoElement.className = "logo";
	logoContainer.appendChild(logoElement);
	
	var logoInsetElement = document.createElement("div");
	logoInsetElement.textContent = "Flash";
	logoInsetElement.className = "logo inset";
	logoContainer.appendChild(logoInsetElement);
	
	var actionButtonElement = document.createElement("div");
	actionButtonElement.className = "actionButton";
	container.appendChild(actionButtonElement);
	actionButtonElement.onclick = function(event){if(!didClickAndHold){clickHandler.openActionMenu(event);}};
	
	var clickAndHoldTimeout;
	actionButtonElement.onmousedown = function(event) {
		var clickedAndHeld = function() {
			didClickAndHold = true;
			placeholderElement.oncontextmenu(event);
		};
		didClickAndHold = false;
		clickAndHoldTimeout = setTimeout(clickedAndHeld, 250);
	};
	actionButtonElement.onmouseup = function(event) {
		clearTimeout(clickAndHoldTimeout);
	};
	
	// Wait until the placeholder has a width and height, then
	// check if we should minify or hide the badge
	var badgeHide = function() {
		if (placeholderElement.offsetWidth > 0 && logoElement.offsetWidth > 0 && placeholderElement.offsetHeight > 0 && logoElement.offsetHeight > 0) {
			// If the badge is too big, try displaying it at half size
			if ((placeholderElement.offsetWidth - 4) < logoElement.offsetWidth || (placeholderElement.offsetHeight - 4) < logoElement.offsetHeight) {
				logoContainer.className = "logoContainer mini";
			}

			// If it's still too big, just hide it
			if ((placeholderElement.offsetWidth - 4) < logoElement.offsetWidth || (placeholderElement.offsetHeight - 4) < logoElement.offsetHeight) {
				logoContainer.style.display = "none";
			}
			
			// Check if we should hide the action button
			if ((placeholderElement.offsetWidth - 4) < logoElement.offsetWidth + actionButtonElement.offsetWidth + 8 || (placeholderElement.offsetHeight - 4) < actionButtonElement.offsetHeight) {
				actionButtonElement.style.display = "none";
			} 
		} else {
			setTimeout(badgeHide, 100);
		}
	};
	badgeHide();
	
	if (!this.settings["useH264"]) {
		return;
	}
	
	// Deal with h264 videos
	var flashvars = element.getAttribute("flashvars");
	var src = element.src;
	
	for (i = 0; i < this.killers.length; i++) {
		var currentKiller = this.killers[i];
		var matches = false;
		
		for (j = 0; !matches && j < currentKiller.sourcePatterns.length; j++) {
			var currentPattern = currentKiller.sourcePatterns[j];
			if (src.match(currentPattern)) {
				matches = true;
			}
		}
		
		for (j = 0; !matches && j < currentKiller.flashVarsPatterns.length; j++) {
			var currentPattern = currentKiller.flashVarsPatterns[j];
			if (src.match(currentPattern)) {
				matches = true;
			}
		}
		
		if (matches) {
			var shouldUseHD = this.settings["useHDH264"];
			var videoMapping = this.videoElementMapping;
			var killerCallback = function(sender, element, videoURL, hdVideoURL) {
				var videoElementURL = null;
				var badgeLabel = null;
				
				if (shouldUseHD && hdVideoURL) {
					videoElementURL = hdVideoURL;
					badgeLabel = "QuickTime HD";
				}  else if (videoURL) {
					videoElementURL = videoURL;
					badgeLabel = "QuickTime";
				} else {
					return;
				}
				
				var elementID = element.elementID;
				
				videoMapping[elementID] = videoElementURL;
				
				// Change the placeholder text
				var placeholderLogoInset = placeholderElement.firstChild.firstChild.firstChild.firstChild.childNodes[0];
				placeholderLogoInset.textContent = badgeLabel;
				var placeholderLogo = placeholderElement.firstChild.firstChild.firstChild.firstChild.childNodes[1];
				placeholderLogo.textContent = badgeLabel;
			};
			currentKiller.processElement(element, killerCallback);
			break;
		}
	}
};

getFlashVariable = function(flashVars, key) {
	if (!flashVars)
		return null;
		
	var vars = flashVars.split("&");
	for (var i=0; i < vars.length; i++) {
		var keyValuePair = vars[i].split("=");
		if (keyValuePair[0] == key) {
			return keyValuePair[1];
		}
	}
	return null;
};

var CTF = new ClickToFlash();
CTF.killers = [new YouTubeKiller(), new DailyMotionKiller(), new VimeoKiller()];
