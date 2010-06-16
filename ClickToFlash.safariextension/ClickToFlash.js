function ClickToFlash() {
	this.elementMapping = new Array();
	
	this.videoElementMapping = new Array();
	this.videoElementMapping720p = new Array();
	this.videoElementMapping1080p = new Array();
	
	this.settings = null;
	
	var _this = this;
	this.nodeInsertedTrampoline = function(event) {
		_this.nodeInserted(event);
	}
	
	this.respondToMessage = function(event) {
		if (event.name == "getSettings") {
			_this.getSettings(event);
		}
	}
	
	safari.self.addEventListener("message", this.respondToMessage, false);
}

ClickToFlash.prototype.nodeInserted = function(event) {
	if (event.target instanceof HTMLEmbedElement) {
		this.stopListening();
		event.target.elementID = this.elementMapping.length;
		this.processFlashElement(event.target);
		setTimeout(this.startListening, 500);
	}
}

ClickToFlash.prototype.startListening = function() {
	document.addEventListener("DOMNodeInserted", this.nodeInsertedTrampoline, false);
}

ClickToFlash.prototype.stopListening = function() {
	document.removeEventListener("DOMNodeInserted", this.nodeInsertedTrampoline, false);
}

ClickToFlash.prototype.clickPlaceholder = function(event) {
	// Temporarily disable watching the DOM
	// Otherwise, we'll trigger ourselves by adding the <embed>
	this.stopListening();
	
	var clickedElement = event.target;
	
	while (clickedElement.className != "clickToFlashPlaceholder") {
		clickedElement = clickedElement.parentNode;
	}
	
	var elementID = parseInt(clickedElement.id.replace("ClickToFlashPlaceholder", ""));

	var element = this.videoElementMapping[elementID];
	if (!element) {
		element = this.elementMapping[elementID];
	}
	
	clickedElement.parentNode.replaceChild(element, clickedElement);

	setTimeout(this.startListening, 500);
}

ClickToFlash.prototype.getFlashVariable = function(flashVars, key) {
	var vars = flashVars.split("&");
	for (var i=0; i < vars.length; i++) {
		var keyValuePair = vars[i].split("=");
		if (keyValuePair[0] == key) {
			return keyValuePair[1];
		}
	}
	return null;
}

ClickToFlash.prototype.isSIFRText = function(element) {
	return (element.className == "sIFR-flash" || element.getAttribute("sifr"));
}

ClickToFlash.prototype.processYouTubeElement = function(element) {
	if (!this.settings["useH264"]) {
		return;
	}
	
	var elementID = element.elementID;
	var flashvars = element.getAttribute("flashvars");
	var videoID = this.getFlashVariable(flashvars, "video_id");
	var videoHash = this.getFlashVariable(flashvars, "t");
	var placeholderElement = document.getElementById("ClickToFlashPlaceholder" + elementID);
	
	var availableFormats = [];
	var formatInfo = unescape(this.getFlashVariable(flashvars, "fmt_url_map")).split("|");
	for (i = 0; i < formatInfo.length-1; i += 2) {
		availableFormats[formatInfo[i]] = formatInfo[1+1];
	}
	if (!availableFormats[18]) {
		// Format 18 (360p h264) tends not to be listed, but it
		// should exist for every video. Just add it manually
		// Hopefully 18 exists for every video, or this throws
		// this whole thing out of whack
		availableFormats[18] = "http://www.youtube.com/get_video?fmt=18&video_id=" + videoID + "&t=" + videoHash;
	}

	// Get the highest-quality version <= the resolution set by the user
	var format = 18;
	var badgeLabel = "YouTube";
	if (this.settings["youTubeResolution"] == "1080p" && availableFormats[37]) {
		format = 37;
		badgeLabel = "YouTube 1080p";
	} else if ((this.settings["youTubeResolution"] == "1080p" || this.settings["youTubeResolution"] == "720p") && availableFormats[22]) {
		format = 22;
		badgeLabel = "YouTube 720p";
	}
	var videoURL = "http://www.youtube.com/get_video?fmt=" + format + "&video_id=" + videoID + "&t=" + videoHash;
	
	// Create the video element
	var videoElement = document.createElement("video");
	videoElement.src = videoURL;
	videoElement.setAttribute("controls", "controls");
	if (this.getFlashVariable(flashvars, "autoplay") == "1") {
		videoElement.setAttribute("autoplay", "autoplay");
	}
	videoElement.style = placeholderElement.style;
	videoElement.style.width = placeholderElement.offsetWidth + "px";
	videoElement.style.height = placeholderElement.offsetHeight + "px";
	this.videoElementMapping[elementID] = videoElement;
	
	// Change the placeholder text to "YouTube"
	var placeholderLogoInset = placeholderElement.firstChild.firstChild.firstChild.childNodes[0];
	placeholderLogoInset.innerHTML = badgeLabel;
	var placeholderLogo = placeholderElement.firstChild.firstChild.firstChild.childNodes[1];
	placeholderLogo.innerHTML = badgeLabel;
}

ClickToFlash.prototype.processFlashElement = function(element) {
	// Check if it's already in the mapping dictionary
	// If so, the user must have clicked it already
	if (this.elementMapping[element.elementID]) {
		return;
	}
	
	// Deal with sIFR first
	if (this.isSIFRText(element)) {
		var autoloadSIFR = this.settings["sifrReplacement"];
		if (this.settings["sifrReplacement"] == "autoload") {
			// Just stop processing. The flash movie will
			// continue being loaded
			return;
		}
	}

	var placeholderElement = document.createElement("div");
	placeholderElement.style = element.style;
	placeholderElement.style.width = element.offsetWidth + "px";
	placeholderElement.style.height = element.offsetHeight + "px";
	placeholderElement.className = "clickToFlashPlaceholder";

	var id = element.elementID;
	this.elementMapping[id] = element;
	placeholderElement.id = "ClickToFlashPlaceholder" + id;

	var clickHandler = this;
	placeholderElement.onclick = function(event){clickHandler.clickPlaceholder(event)};

	element.parentNode.replaceChild(placeholderElement, element);
	
	var verticalPositionElement = document.createElement("div");
	verticalPositionElement.className = "logoVerticalPosition";
	placeholderElement.appendChild(verticalPositionElement);

	var horizontalPositionElement = document.createElement("div");
	horizontalPositionElement.className = "logoHorizontalPosition";
	verticalPositionElement.appendChild(horizontalPositionElement);

	var logoContainer = document.createElement("div");
	logoContainer.className = "logoContainer";
	horizontalPositionElement.appendChild(logoContainer);
	
	var logoElement = document.createElement("div");
	logoElement.innerHTML = "Flash";
	logoElement.className = "logo";
	logoContainer.appendChild(logoElement);
	
	var logoInsetElement = document.createElement("div");
	logoInsetElement.innerHTML = "Flash";
	logoInsetElement.className = "logo inset";
	logoContainer.appendChild(logoInsetElement);
	
	// If the badge is too big, try displaying it at half size
	if ((placeholderElement.offsetWidth - 4) < logoElement.offsetWidth || (placeholderElement.offsetHeight - 4) < logoElement.offsetHeight) {
		logoContainer.className = "logoContainer mini";
	}
	
	// If it's still too big, just hide it
	if ((placeholderElement.offsetWidth - 4) < logoElement.offsetWidth || (placeholderElement.offsetHeight - 4) < logoElement.offsetHeight) {
		logoContainer.style.display = "none";
	}
	
	// Deal with h264 YouTube videos
	var youTubeShouldUseH264 = true;
	if (youTubeShouldUseH264) {
		var flashvars = element.getAttribute("flashvars");
		var src = element.src;
		var fromYouTube = (src && src.indexOf("youtube.com") != -1) ||
		                  (src && src.indexOf("youtube-nocookie.com") != -1) ||
		                  (src && src.indexOf("ytimg.com") != -1) ||
		                  (flashvars && flashvars.indexOf("youtube.com") != -1) ||
		                  (flashvars && flashvars.indexOf("youtube-nocookie.com") != -1) ||
		                  (flashvars && flashvars.indexOf("ytimg.com") != -1);

		if (fromYouTube) {
			this.processYouTubeElement(element);
		}
	}
}

ClickToFlash.prototype.removeFlash = function() {
	this.stopListening();
	
	var embedElements = document.getElementsByTagName("embed");
	var objectElements = document.getElementsByTagName("object");
	var flashElements = [];
	for (i = 0; i < objectElements.length; i++) {
		flashElements[flashElements.length] = objectElements[i];
	}
	for (i = 0; i < embedElements.length; i++) {
		flashElements[flashElements.length] = embedElements[i];
	}
	
	for (i = 0; i < flashElements.length; i++) {
		if (!this.settings) {
			safari.self.tab.dispatchMessage("getSettings", null);
			return;
		}
		
		var element = flashElements[i];
		element.elementID = this.elementMapping.length;
		this.processFlashElement(element);
	}

	this.startListening();
}

ClickToFlash.prototype.getSettings = function(event) {
	this.settings = [];
	this.settings["useH264"] = event.message.useH264;
	this.settings["youTubeResolution"] = event.message.youTubeResolution;
	this.settings["sifrReplacement"] = event.message.sifrReplacement;
	
	this.removeFlash();
}
