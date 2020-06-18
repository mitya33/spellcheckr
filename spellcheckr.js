/* ---
| CONSTRUCTOR - args:
|	@params (obj) - object of constructor params
--- */

'use strict';

var Spellcheckr = function(params) { $(function() {

	//transfer constructor params to instance
	for (var param in params) this[param] = params[param];

	//checks
	if (!this.field || !$(this.field).length)
		return console.error('Spellcheckr - no field found; @field param missing or does not point to element in DOM', this.field);
	else
		this.field = $(this.field);
	if (typeof this.dictionaries != 'object')
		return console.error('Specllcheckr - no dictionaries specified to @dictionaries');

	//log some grammatical words that there's no point checking, to boost performance
	this.grammatical_words = ['of', 'in', 'the', 'a', 'he', 'she', 'him', 'her', 'he', 'they', 'we', 'at', 'under', 'over', 'off', 'on', 'with', 'for', 'there', 'this', 'that', 'those', 'these', 'with', 'up', 'down', 'who', 'what', 'when', 'where', 'why', 'while'];

	//try to ensure no native spellchecker or similar functionality coming from browser
	['autocomplete', 'autocorrect', 'autocapitalize', 'spellcheck'].forEach(function(attr) {
		this.field.attr(attr, attr != 'spellcheck' ? 'off' : 'false');
	}.bind(this));

	//some bits
	var err_tmplt = 'Spellcheckr - invalid value for param @{param}';
	this.mode = this.mode || 'ui';
	if (['ui', 'contextual', 'both'].indexOf(this.mode) == -1) return console.error(err_tmplt.replace('{param}', 'mode'));
	this.ui_display = this.ui_display || 'popup';
	if (['dialog', 'inline'].indexOf(this.ui_display) == -1) return console.error(err_tmplt.replace('{param}', 'ui_display')); 
	this.ls_key = 'spellcheckr_dic_'+this.lang;
	this.change_or_ignore_all = [];
	this.specify_other = {};
	this.allow_other = typeof this.allow_other == 'undefined' || !!this.allow_other;
	this.allow_storage = typeof this.allow_storage == 'undefined' || !!this.allow_storage;
	this.allow_add_word = typeof this.allow_add_word == 'undefined' || !!this.allow_add_word;
	this.bad_words_to_suggestions_map = {};

	//set labels (may be incoming if non-English usage)
	this.labels = $.extend({
		start: 'Spellcheck',
		intro: 'Unrecognised,',
		replace_with: 'Replace with...',
		change: 'Change',
		change_all: 'Change all',
		ignore: 'Ignore',
		ignore_all: 'Ignore all',
		add: 'Add to My Words',
		restart: 'Restart',
		specify: '...other (specify)',
		no_suggestions: '(no suggestions)',
	}, this.labels || {});

	//establish default lang, and that it corresponds to a passed dictionary
	if (!this.lang) this.lang = Object.keys(this.dictionaries)[0];
	if (!this.dictionaries[this.lang])
		return console.error('Spellcheckr - no dictionary specified in @dictioanries for default language "'+this.lang+'"');

	//build DOM
	this.dom();

	//listen for Spellcheckr
	this.Spellcheckr();

}.bind(this)); };

/* ---
| DOM - DOM stuff inc. build UI
--- */

Spellcheckr.prototype.dom = function() {

	//wrap field in container
	this.field.wrap('<div class="spellcheckr-wrapper"></div>');
	this.wrapper = this.field.parent();
	if (this.mode != 'contextual') this.wrapper.attr('data-ui-mode', 1);
	if (this.mode != 'ui') this.wrapper.attr('data-contextual-mode', 1);
	if (this.ui_display == 'dialog') this.wrapper.attr('data-ui-dialog', 1);

	//build lightbox, if UI mode and should display as dialog, not inline
	if (this.mode != 'contextual' && this.ui_display == 'dialog') {
		this.dialog_lb = $('<div />').addClass('spellcheckr-lb').prependTo(this.wrapper);
	}

	//build UI, if UI mode
	var ui_html = `
		<br>
		<aside class=spellcheckr-tools>
			<p class=row1>
				<a class=do>${this.labels.start}</a>
				<select class=lang>${(() => { let ret = ''; for (var lang_code in this.dictionaries) ret += '<option value="'+lang_code+'">'+lang_code.toUpperCase()+'</option>'; return ret; })()}
				</select>
				${(!this.dialog_lb ? `
				<span class=active-problem></span>` : '')}
				<a class=close>&times;</a>
				<a class=restart>${this.labels.restart}</a>
			</p>
			${(!this.dialog_lb ? '' : `
			<p class=row1b active-problem></p>`)}
			<p class=row2>
				<select${(!this.dialog_lb ? '' : ` multiple`)} class=suggestions>
					<option value=''>${this.labels.replace_with}</option>
					<option value=''>--------------</option>
					${(this.allow_other ? `<option value=''>${this.labels.specify}</option>` : '')}
				</select>
				${(this.allow_other ? `
				<input type=text placeholder="${this.labels.specify}" />` : '')}${(!this.dialog_lb ? '' : `
				</p><p class=dialog-tools-column>`)}
				<a class=change>${this.labels.change}</a>
				<a class=change-all>${this.labels.change_all}</a>
				<a class=ignore>${this.labels.ignore}</a>
				<a class=ignore-all>${this.labels.ignore_all}</a>
				${(this.allow_add_word ? `
				<a class=add-to-dic>${this.labels.add}</a>` : '')}
			</p>
		</aside>`;
	this.field.after(ui_html);
	this.ui = this.field.siblings('.spellcheckr-tools');

	//build field overlay
	this.overlay = $('<div />').addClass('spellcheckr-overlay').css({
		width: this.field.css('width'),
		height: this.field.css('height'),
		paddingTop: this.field.css('padding-top'),
		boxSizing: this.field.css('border-box'),
		paddingRight: this.field.css('padding-right'),
		paddingBottom: this.field.css('padding-bottom'),
		paddingLeft: this.field.css('padding-left'),
		fontFamily: this.field.css('font-family'),
		fontSize: this.field.css('font-size'),
		lineHeight: this.field.css('line-height'),
		color: this.field.css('color'),
		background: this.field.css('background-color'),
		borderWidth: this.field.css('border-left-width'),
		borderStyle: this.field.css('border-left-style'),
		borderColor: this.field.css('border-left-color'),
		marginTop: this.field.css('margin-top'),
		marginRight: this.field.css('margin-right'),
		marginBottom: this.field.css('margin-bottom'),
		marginLeft: this.field.css('margin-left'),
		whiteSpace: this.field.css('white-space')
	}).insertAfter(this.field);

	//hide field background and text so overlay shows through
	this.field[0].style.color = this.field[0].style.background = 'transparent';

	//if contextual mode, build context menu that shows when right-clicking on problem word
	if (this.mode != 'ui') {
		this.cm_template = `
		<li class=no-click>
			<strong>{word}</strong>
		</li>
		<li data-action=ignore>${this.labels.ignore}</li>
		<li data-action=ignore-all>${this.labels.ignore_all}</li>
		<li data-action=add-to-dic>${this.labels.add}</li>
		<li class=no-click>${this.labels.replace_with}</li>
		{suggestions}
		<li class=indent data-action=specify>${this.labels.specify}</li>`;
		this.spellcheckr_cm = $('<ul />').addClass('spellcheckr-cm').appendTo(this.wrapper);
		$('body').on('click focus', function(evt) { if (!$(evt.target).closest('.spellcheckr-cm').length) this.spellcheckr_cm.fadeOut(); }.bind(this));
	}

	//commit words to overlay (as spans) as input value changes. If dialog mode, also log the containing sentence, to show that (see ::feedback())
	this.field.on('input', function() {
		var html = this.field.val()
			.replace(/([\w\u0430-\u044f\u0401\-']+)/ig, '<span>$1</span>')
			.replace(/([\?\.!])/g, '<span class="end-of-sntnc-sign">$1</span>');
		this.overlay.html(html);
	}.bind(this)).trigger('input');

	//if contextual mode, do spellcheck constantly, on input to field (else if UI mode, only when spellcheck
	//button clicked)
	if (this.mode != 'ui') {
		var to;
		this.field.on('input', function() {
			clearTimeout(to);
			to = setTimeout(function() { this.do_spellcheck(null, 1); }.bind(this), 200);
		}.bind(this)).trigger('input');
	}

	//on textarea scroll, scroll overlay
	this.field.on('scroll input', this.onScrollCallback = () => 
		this.overlay[0].scrollTop = this.field[0].scrollTop
	);

	//listen for toggle "specify other" field
	this.ui.on('change', '.suggestions', function() {
		var input = $(this).next()
		input[$(this).children(':selected').is(':last-child') ? 'show' : 'hide']();
		$(this).trigger('blur').next()[0].focus();
	});

	//listen for close
	this.ui.on('click', '.close', function() { this.wrapper.removeClass('active'); }.bind(this));

	//on blur to UI, always go back to field - that way we retain any highlighting on bad words
	this.ui.on('blur', '*', function() { this.field[0].focus(); }.bind(this));

	//listen for change/change all actions
	this.ui.on('click', '.change, .change-all', function(evt) {
		if (this.get_repl()) {
			this.curr_bad_word_el.text(this.get_repl()).removeClass('problem');
			if ($(evt.target).is('.change-all')) {
				this.curr_bad_word_el.siblings().filter(function(i, el) { return $(el).text() == this.curr_bad_word; }.bind(this)).text(this.get_repl()).removeClass('problem');
				this.change_or_ignore_all.push(!this.case_sensitive ? this.curr_bad_word.toLowerCase() : this.curr_bad_word);;
			}
			this.curr_bad_word_index++;
			this.field.val(this.overlay.text());
			this.feedback();
		}
	}.bind(this));

	//listen for ignore actions
	this.ui.on('click', '.ignore, .ignore-all', function(evt, is_from_contextual) {
		this.curr_bad_word_el.removeClass('problem');
		if (evt && $(evt.target).is('.ignore-all') || is_from_contextual == 'all') {
			this.curr_bad_word_el.siblings().filter(function(i, el) { return $(el).text() == this.curr_bad_word; }.bind(this)).removeClass('problem'); 
			this.change_or_ignore_all.push(!this.case_sensitive ? this.curr_bad_word.toLowerCase() : this.curr_bad_word);;
		} else
			this.curr_bad_word_el.addClass('ignore-single-instance');
		if (!is_from_contextual) {
			this.curr_bad_word_index++;
			this.feedback();
		}
	}.bind(this));

	//listen for 'add to my words' actions
	this.ui.on('click', '.add-to-dic', function(evt, is_from_contextual) {
		this.curr_bad_word_el.add(this.curr_bad_word_el.siblings().filter(function(i, el) { return $(el).text() == this.curr_bad_word; }.bind(this))).removeClass('problem');
		var my_words = localStorage[this.ls_key+'_my_words'] || {};
		if (typeof my_words != 'object') my_words = JSON.parse(my_words);
		my_words[this.curr_bad_word.toLowerCase()] = this.dictionary[this.curr_bad_word.toLowerCase()] = 1;
		if (!is_from_contextual) this.ui.find('.ignore').trigger('click');
		localStorage[this.ls_key+'_my_words'] = JSON.stringify(my_words);
	}.bind(this));

	//listen for switch language...
	this.ui.find('.lang').on('change', function(evt, onload_auto_select) {
		if (onload_auto_select) $(evt.target).val(onload_auto_select);
		console.log('Spellcheckr - switched language to '+$(evt.target).val().toUpperCase());
		delete this.dictionary;
		this.lang = $(evt.target).val();
		this.ls_key = 'spellcheckr_dic_'+this.lang;

		//...//if switched mid-spellcheck, restart with new language
		if (this.wrapper.is('.active')) this.do_spellcheck();

		//...if contextual mode, reassess contextual problems
		this.field.trigger('input');

	}.bind(this)).trigger('change', this.lang);

	//if contextual mode, listen for right-clicks on bad words. Find corresponding word span in overlay by comparing mouse/span coordinates...
	this.field.on('contextmenu', function(evt) {
		var mouse_x = evt.pageX - this.field.offset().left, mouse_y = evt.pageY - this.field.offset().top;
		this.overlay.find('.problem').each(function(i, el) {
			var os = $(el).position();
			if (os.left < mouse_x && os.top - mouse_y && os.left + $(el).width() > mouse_x && os.top + $(el).height() > mouse_y) {
				evt.preventDefault();
				var cm_html = this.cm_template.replace('{word}', $(el).text()).replace('{suggestions}', (function() {
					var ret = '',
					word = $(el).text().toLowerCase(),
					suggestions = this.get_suggestions(word);
					for (var suggestion in suggestions) ret += '<li class="indent" data-action="replace">'+suggestion+'</li>';
					return ret;
				}).call(this));
				this.spellcheckr_cm.css({left: mouse_x, top: mouse_y}).html(cm_html).fadeIn();
				this.curr_bad_word = $(el).text();
				this.curr_bad_word_el = $(el);
				return false;
			}
		}.bind(this));
	}.bind(this));

	//...and for context menu choices
	if (this.spellcheckr_cm) this.spellcheckr_cm.on('click', 'li[data-action]', function(evt) {
		switch ($(evt.target).data('action')) {
			case 'ignore': this.ui.find('.ignore').trigger('click', 1); break;
			case 'ignore-all': this.ui.find('.ignore').trigger('click', 'all'); break;
			case 'add-to-dic': this.ui.find('.add-to-dic').trigger('click', 1); break;
			case 'specify': this.curr_bad_word_el.text(prompt('Enter a replacement', this.curr_bad_word) || this.curr_bad_word); break;
			case 'replace': this.curr_bad_word_el.text($(evt.target).text()).removeClass('problem'); break;
		}
		console.log(this.spellcheckr_cm.data('suggestions'));
		this.field.val(this.overlay.text());
		this.spellcheckr_cm.hide();
	}.bind(this));

	//prevent submit until errors resolved?
	if (this.prevent_submit) this.field.closest('form').on('submit', function(evt) {
		if ((this.mode != 'ui' && this.overlay.find('.problem').length)) {
			evt.preventDefault();
			alert('Please fix spelling errors before continuing');
		}
	}.bind(this));

};

/* ---
| LOAD DICTIONARY - and parse it into object. May already be in localStorage. Also log the letters of the language's alphabet while here (from the unique
| first letters in the dictionary.) Args:
|	@flush (bool) - if localStorage copy is ruined in any way (i.e. can't be parsed as JSON), attempts fresh load of file
--- */

Spellcheckr.prototype.load_dic = function(flush) {
	if (this.dictionary) return true;
	this.alphabet_letters = {};
	this.dic_dfd = new $.Deferred;

	//load from file
	if (!localStorage[this.ls_key] || flush || !this.allow_storage) {
		var no_cache_suffix = location.search.indexOf('spellcheck_flush=1') == -1 ? '' : '?r='+Math.random();
		$.get(this.dictionaries[this.lang]+no_cache_suffix)
			.done(function(words) {				
				if (this.allow_storage) localStorage[this.ls_key] = words.toLowerCase();
				this.parse_dic(words.toLowerCase());
			}.bind(this))
			.error(function() { console.error('Could not load Spellcheckr dictionary at '+this.dictionaries[this.lang]); }.bind(this));

	//load from local storage
	} else {
		this.parse_dic(localStorage[this.ls_key]);
		this.dic_dfd.resolve();
	}

	return this.dic_dfd;
};

Spellcheckr.prototype.parse_dic = function(words) {
	var my_words = localStorage[this.ls_key+'_my_words'] || {};
	if (typeof my_words != 'object') my_words = JSON.parse(my_words);
	this.dictionary = words.split('|').reduce(function(prev, curr) {
		prev[curr] = 1;
		this.alphabet_letters[curr[0]] = 1;
		return prev;
	}.bind(this), {});
	this.dictionary = $.extend(this.dictionary, my_words);
	this.dictionary;
	this.dic_dfd.resolve();
}

/* ---
| SPELLCHECK - main func for doing spellcheck. Runs in two modes - UI and contextual. Former calls func only when spellcheck button manually clicked;
| latter calls func contstantly, on input to field. In case of former, highlight one bad word at a time and show feedback UI; in case of latter, highlight
| all bad words (that's it).
--- */

Spellcheckr.prototype.Spellcheckr = function() {
	this.ui.on('click', '.do, .restart', this.do_spellcheck = function(evt, is_from_contextual) { $.when(this.load_dic()).then(function() {

		//prep
		if (evt) evt.preventDefault();
		this.curr_bad_word_index = 0;

		//gather up words
		var words = this.overlay.children('span:not(.end-of-sntnc-sign)');
		this.problem_words = [];

		//evaluate each...
		words.each(function(i, el) {
			var word = $(el).text().toLowerCase();
			if (
				!this.dictionary[word] &&
				this.grammatical_words.indexOf(word) == -1 &&
				this.change_or_ignore_all.indexOf(!this.case_sensitive ? word.toLowerCase() : word) == -1 &&
				!$(el).is('.ignore-single-instance')
			)

				//..if problematic, log it for feedback. If dialog mode, also log word's surrounding prev and remaining parts of sentence, if any
				this.problem_words.push({
					word: $(el).text(),
					el: $(el).addClass('problem'),
					surrounding_sentence_parts: !this.dialog_lb ? null : (function() {
						var
						prev_part_of_sntnc = $.map($(el).prevUntil('.end-of-sntnc-sign'), function(el) { return $(el).text(); }),
						next_els_in_sntnc = $(el).nextUntil('.end-of-sntnc-sign'),
						is_final_word_of_sntnc = $(el).next().is('.end-of-sntnc-sign'),
						remainder_of_sntnc = !is_final_word_of_sntnc ? $.map(next_els_in_sntnc, function(el) { return $(el).text(); }) : [];
						prev_part_of_sntnc.reverse();
						return [
							prev_part_of_sntnc.join(' '),
							remainder_of_sntnc.join(' ')+(!is_final_word_of_sntnc ? next_els_in_sntnc.last().next().text() : $(el).next().text())
						];
					})(),
					suggestions: Object.keys(this.get_suggestions(word))
				});
		}.bind(this));

		//if contexutal mode and request came from input, not click to spellcheck button, highlight all bad words - otherwise, continue to feedback
		if (is_from_contextual) return;

		//begin feedback if problems found else notify all OK
		console.log('Spellcheckr - result', this.problem_words);
		this.problem_words.length ? this.feedback() : alert('No spelling errors found!');

	}.bind(this)); }.bind(this));
};

/* ---
| GET SUGGESTIONS - if a word isn't found, we're sent here to get suggestions for what it might have been. Returns array of suggestions. Args:
|	@lookup (str)	- the word to look up
--- */

Spellcheckr.prototype.get_suggestions = function(lookup) {

	let suggestions = {},
		word,
		word2;

	//already cached this word's suggestions?
	if (this.bad_words_to_suggestions_map[lookup]) return this.bad_words_to_suggestions_map[lookup];

	//...method 1: iteratively shave off a letter - this handles words misspelt through an added latter e.g. rabbitr => rabbit, rabbi
	let word_arr = lookup.split(/(?=.)/),
		curLetters = word_arr.slice( 0 );
	while (curLetters.length > 2) {
		if (this.dictionary[curLetters.join('')]) suggestions[curLetters.join('')] = 1;
		curLetters.pop();
	}

	//...method 2: check for extraneous letters within the word. Iteratively remove each letter and look up, e.g. rabybit => rabbit
	for (var g=0; g<lookup.length; g++) {
		word = lookup.substr(0, g)+lookup.substr(g+1);
		if (this.dictionary[word]) suggestions[word] = 1;
	}

	//...method 3: check for missing or errneous letters. Iteratively add/replace a letter (try each of the alphabet's letters) at each position,
	//e.g. rabit => rabbit and rabyit => rabbit
	for (var g=0; g<lookup.length; g++)
		for (var letter in this.alphabet_letters) {
			word = lookup.substr(0, g)+letter+lookup.substr(g);
			word2 = lookup.substr(0, g)+letter+lookup.substr(g+1);
			if (this.dictionary[word]) suggestions[word] = 1;
			if (this.dictionary[word2]) suggestions[word2] = 1;
		}

	//...method 4: check for neighbouring words the wrong way round, e.g. rabbti => rabbit
	for (var g=0; g<lookup.length-1; g++) {
		word = lookup.substr(0, g)+lookup[g+1]+lookup[g]+lookup.substr(g+2);
		if (this.dictionary[word]) suggestions[word] = 1;
	}

	this.bad_words_to_suggestions_map[lookup] = suggestions;
	return suggestions;

};

/* ---
| FEEDBACK - show feedback re: the next bad word to be dealt with.
--- */

Spellcheckr.prototype.feedback = function() {

	var obj = this.problem_words[this.curr_bad_word_index];
	if (obj && this.change_or_ignore_all.indexOf(!this.case_sensitive ? obj.word.toLowerCase() : obj.word) != -1) {
		this.curr_bad_word_index++;
		return this.feedback();
	}

	//done?
	if (!obj) {
		this.wrapper.removeClass('active');
		alert('Spellcheck complete.');
		//this.field[0].selectionStart = this.field[0].selectionEnd = 0;
		return;
	}

	//establish text to demonstrate problem - depends on whether inline (intro + word) or dialog mode (sentence containing problem, with problem highlighted)
	var problem_demo_text = !this.dialog_lb ?
		this.labels.intro+' <strong>"'+obj.word+'"</strong>' :
		(obj.surrounding_sentence_parts[0]+' <span class="problem">'+obj.word+'</span> '+obj.surrounding_sentence_parts[1]).replace(/ (?=[\?\.!])/, '');

	//populate/set up UI...
	this.curr_bad_word = obj.word;
	this.curr_bad_word_el = obj.el.addClass('curr-bad-word');
	obj.el.siblings().removeClass('curr-bad-word');
	this.ui.find('input').val('');
	this.wrapper.addClass('active');
	this.ui.find('.active-problem').html(problem_demo_text);
	var dd = this.ui.find('.suggestions');
	dd.children(':first').prop('selected', 1).trigger('change');
	dd.children(':not([value=""])').remove();
	var ins_after = dd.children(':nth-child(2)');

	//...build suggestion options - include any custom replacements for this word seen previously
	if (this.specify_other[this.curr_bad_word]) this.specify_other[this.curr_bad_word].forEach(function(prev_choice) { obj.suggestions.push(prev_choice); });
	for (var k=0; k<obj.suggestions.length; k++) $('<option />', {text: obj.suggestions[k]}).insertAfter(ins_after);
	if (!dd.children(':not([value=""])').length) $('<option />', {text: '(no suggestions)', value: ''}).insertAfter(ins_after);
	dd.children(':first').prop('selected', 1);

};

/* ---
| REPLACEMENT - get replacement preference
--- */

Spellcheckr.prototype.get_repl = function() {

	//establish replacement choice
	var input = this.ui.find('input:visible'), ret = input.val() || this.ui.find('.suggestions').val();
	if (!ret) alert('Spellcheck - you must choose a replacement option');

	//if specified custom choice, remember it so if we meet this word again later (and change-all not chosen), we can suggest same choice
	if (input.length) {
		if (!this.specify_other[this.curr_bad_word]) this.specify_other[this.curr_bad_word] = [];
		if (this.specify_other[this.curr_bad_word].indexOf(input.val()) == -1) this.specify_other[this.curr_bad_word].push(input.val());
		console.log(this.specify_other);
	}

	this.field[0].focus();
	return ret;

}