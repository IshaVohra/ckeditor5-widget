/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import VirtualTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/virtualtesteditor';
import Widget from '../src/widget';
import Typing from '@ckeditor/ckeditor5-typing/src/typing';
import MouseObserver from '@ckeditor/ckeditor5-engine/src/view/observer/mouseobserver';
import { downcastElementToElement } from '@ckeditor/ckeditor5-engine/src/conversion/downcast-converters';
import { toWidget } from '../src/utils';
import ViewContainer from '@ckeditor/ckeditor5-engine/src/view/containerelement';
import ViewEditable from '@ckeditor/ckeditor5-engine/src/view/editableelement';
import DomEventData from '@ckeditor/ckeditor5-engine/src/view/observer/domeventdata';
import AttributeContainer from '@ckeditor/ckeditor5-engine/src/view/attributeelement';
import { setData as setModelData, getData as getModelData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';
import { getData as getViewData } from '@ckeditor/ckeditor5-engine/src/dev-utils/view';
import { keyCodes } from '@ckeditor/ckeditor5-utils/src/keyboard';

/* global document */

describe( 'Widget', () => {
	let editor, model, viewDocument;

	beforeEach( () => {
		return VirtualTestEditor.create( { plugins: [ Widget, Typing ] } )
			.then( newEditor => {
				editor = newEditor;
				model = editor.model;
				viewDocument = editor.editing.view;

				model.schema.register( 'widget', {
					inheritAllFrom: '$block',
					isObject: true
				} );
				model.schema.register( 'paragraph', {
					inheritAllFrom: '$block',
					allowIn: 'div'
				} );
				model.schema.register( 'inline', {
					allowWhere: '$text',
					isObject: true
				} );
				model.schema.register( 'nested', {
					allowIn: 'widget',
					isLimit: true
				} );
				model.schema.extend( '$text', {
					allowIn: [ 'nested', 'editable' ]
				} );
				model.schema.register( 'editable', {
					allowIn: [ 'widget', '$root' ]
				} );

				// Image feature.
				model.schema.register( 'image', {
					allowIn: '$root',
					isObject: true,
					isBlock: true
				} );

				// Block-quote feature.
				model.schema.register( 'blockQuote', {
					allowIn: '$root'
				} );
				model.schema.extend( '$block', { allowIn: 'blockQuote' } );

				// Div element which helps nesting elements.
				model.schema.register( 'div', {
					allowIn: [ 'blockQuote', 'div' ]
				} );

				editor.conversion.for( 'downcast' )
					.add( downcastElementToElement( { model: 'paragraph', view: 'p' } ) )
					.add( downcastElementToElement( { model: 'inline', view: 'figure' } ) )
					.add( downcastElementToElement( { model: 'image', view: 'img' } ) )
					.add( downcastElementToElement( { model: 'blockQuote', view: 'blockquote' } ) )
					.add( downcastElementToElement( { model: 'div', view: 'div' } ) )
					.add( downcastElementToElement( {
						model: 'widget',
						view: () => {
							const b = new AttributeContainer( 'b' );
							const div = new ViewContainer( 'div', null, b );

							return toWidget( div, { label: 'element label' } );
						}
					} ) )
					.add( downcastElementToElement( {
						model: 'nested',
						view: () => new ViewEditable( 'figcaption', { contenteditable: true } )
					} ) )
					.add( downcastElementToElement( {
						model: 'editable',
						view: () => new ViewEditable( 'figcaption', { contenteditable: true } )
					} ) );
			} );
	} );

	it( 'should be loaded', () => {
		expect( editor.plugins.get( Widget ) ).to.be.instanceOf( Widget );
	} );

	it( 'should add MouseObserver', () => {
		expect( editor.editing.view.getObserver( MouseObserver ) ).to.be.instanceof( MouseObserver );
	} );

	it( 'should create selection over clicked widget', () => {
		setModelData( model, '[]<widget></widget>' );
		const viewDiv = viewDocument.getRoot().getChild( 0 );
		const domEventDataMock = {
			target: viewDiv,
			preventDefault: sinon.spy()
		};

		viewDocument.fire( 'mousedown', domEventDataMock );

		expect( getModelData( model ) ).to.equal( '[<widget></widget>]' );
		sinon.assert.calledOnce( domEventDataMock.preventDefault );
	} );

	it( 'should create selection when clicked in nested element', () => {
		setModelData( model, '[]<widget></widget>' );
		const viewDiv = viewDocument.getRoot().getChild( 0 );
		const viewB = viewDiv.getChild( 0 );
		const domEventDataMock = {
			target: viewB,
			preventDefault: sinon.spy()
		};

		viewDocument.fire( 'mousedown', domEventDataMock );

		expect( getModelData( model ) ).to.equal( '[<widget></widget>]' );
		sinon.assert.calledOnce( domEventDataMock.preventDefault );
	} );

	it( 'should do nothing if clicked inside nested editable', () => {
		setModelData( model, '[]<widget><nested>foo bar</nested></widget>' );
		const viewDiv = viewDocument.getRoot().getChild( 0 );
		const viewFigcaption = viewDiv.getChild( 0 );

		const domEventDataMock = {
			target: viewFigcaption,
			preventDefault: sinon.spy()
		};

		viewDocument.fire( 'mousedown', domEventDataMock );

		sinon.assert.notCalled( domEventDataMock.preventDefault );
	} );

	it( 'should do nothing if clicked in non-widget element', () => {
		setModelData( model, '<paragraph>[]foo bar</paragraph><widget></widget>' );
		const viewP = viewDocument.getRoot().getChild( 0 );
		const domEventDataMock = {
			target: viewP,
			preventDefault: sinon.spy()
		};

		viewDocument.focus();
		viewDocument.fire( 'mousedown', domEventDataMock );

		expect( getModelData( model ) ).to.equal( '<paragraph>[]foo bar</paragraph><widget></widget>' );
		sinon.assert.notCalled( domEventDataMock.preventDefault );
	} );

	it( 'should not focus editable if already is focused', () => {
		setModelData( model, '<widget></widget>' );
		const widget = viewDocument.getRoot().getChild( 0 );
		const domEventDataMock = {
			target: widget,
			preventDefault: sinon.spy()
		};
		const focusSpy = sinon.spy( viewDocument, 'focus' );

		viewDocument.isFocused = true;
		viewDocument.fire( 'mousedown', domEventDataMock );

		sinon.assert.calledOnce( domEventDataMock.preventDefault );
		sinon.assert.notCalled( focusSpy );
		expect( getModelData( model ) ).to.equal( '[<widget></widget>]' );
	} );

	it( 'should apply fake view selection if model selection is on widget element', () => {
		setModelData( model, '[<widget>foo bar</widget>]' );

		expect( getViewData( viewDocument ) ).to.equal(
			'[<div class="ck-widget ck-widget_selected" contenteditable="false">foo bar<b></b></div>]'
		);
		expect( viewDocument.selection.isFake ).to.be.true;
	} );

	it( 'should use element\'s label to set fake selection if one is provided', () => {
		setModelData( model, '[<widget>foo bar</widget>]' );

		expect( viewDocument.selection.fakeSelectionLabel ).to.equal( 'element label' );
	} );

	it( 'should add selected class when no only a widget is selected', () => {
		setModelData( model, '[<paragraph>foo</paragraph><widget></widget><widget></widget>]' );

		expect( viewDocument.selection.isFake ).to.be.false;
		expect( getViewData( viewDocument ) ).to.equal(
			'[' +
			'<p>foo</p>' +
			'<div class="ck-widget ck-widget_selected" contenteditable="false"><b></b></div>' +
			'<div class="ck-widget ck-widget_selected" contenteditable="false"><b></b></div>' +
			']'
		);
	} );

	it( 'fake selection should be empty if widget is not selected', () => {
		setModelData( model, '<paragraph>foo</paragraph><widget>foo bar</widget>' );

		expect( viewDocument.selection.fakeSelectionLabel ).to.equal( '' );
	} );

	it( 'should toggle selected class', () => {
		setModelData( model, '<paragraph>foo</paragraph>[<widget>foo</widget>]' );

		expect( getViewData( viewDocument ) ).to.equal(
			'<p>foo</p>[<div class="ck-widget ck-widget_selected" contenteditable="false">foo<b></b></div>]'
		);

		model.change( writer => {
			writer.setSelection( null );
		} );

		expect( getViewData( viewDocument ) ).to.equal(
			'<p>{}foo</p><div class="ck-widget" contenteditable="false">foo<b></b></div>'
		);
	} );

	it( 'should do nothing when selection is placed in other editable', () => {
		setModelData( model, '<widget><editable>foo bar</editable></widget><editable>[baz]</editable>' );

		expect( getViewData( viewDocument ) ).to.equal(
			'<div class="ck-widget" contenteditable="false">' +
				'<figcaption contenteditable="true">foo bar</figcaption>' +
				'<b></b>' +
			'</div>' +
			'<figcaption contenteditable="true">{baz}</figcaption>'
		);
	} );

	describe( 'keys handling', () => {
		describe( 'arrows', () => {
			test(
				'should move selection forward from selected object - right arrow',
				'[<widget></widget>]<paragraph>foo</paragraph>',
				keyCodes.arrowright,
				'<widget></widget><paragraph>[]foo</paragraph>'
			);

			test(
				'should move selection forward from selected object - down arrow',
				'[<widget></widget>]<paragraph>foo</paragraph>',
				keyCodes.arrowdown,
				'<widget></widget><paragraph>[]foo</paragraph>'
			);

			test(
				'should move selection backward from selected object - left arrow',
				'<paragraph>foo</paragraph>[<widget></widget>]',
				keyCodes.arrowleft,
				'<paragraph>foo[]</paragraph><widget></widget>'
			);

			test(
				'should move selection backward from selected object - up arrow',
				'<paragraph>foo</paragraph>[<widget></widget>]',
				keyCodes.arrowup,
				'<paragraph>foo[]</paragraph><widget></widget>'
			);

			test(
				'should move selection to next widget - right arrow',
				'[<widget></widget>]<widget></widget>',
				keyCodes.arrowright,
				'<widget></widget>[<widget></widget>]'
			);

			test(
				'should move selection to next widget - down arrow',
				'[<widget></widget>]<widget></widget>',
				keyCodes.arrowdown,
				'<widget></widget>[<widget></widget>]'
			);

			test(
				'should move selection to previous widget - left arrow',
				'<widget></widget>[<widget></widget>]',
				keyCodes.arrowleft,
				'[<widget></widget>]<widget></widget>'
			);

			test(
				'should move selection to previous widget - up arrow',
				'<widget></widget>[<widget></widget>]',
				keyCodes.arrowup,
				'[<widget></widget>]<widget></widget>'
			);

			test(
				'should do nothing on non-collapsed selection next to object - right arrow',
				'<paragraph>ba[r]</paragraph><widget></widget>',
				keyCodes.arrowright,
				'<paragraph>ba[r]</paragraph><widget></widget>'
			);

			test(
				'should do nothing on non-collapsed selection next to object - down arrow',
				'<paragraph>ba[r]</paragraph><widget></widget>',
				keyCodes.arrowdown,
				'<paragraph>ba[r]</paragraph><widget></widget>'
			);

			test(
				'should do nothing on non-collapsed selection next to object - left arrow',
				'<widget></widget><paragraph>[b]ar</paragraph>',
				keyCodes.arrowleft,
				'<widget></widget><paragraph>[b]ar</paragraph>'
			);

			test(
				'should do nothing on non-collapsed selection next to object - up arrow',
				'<widget></widget><paragraph>[b]ar</paragraph>',
				keyCodes.arrowup,
				'<widget></widget><paragraph>[b]ar</paragraph>'
			);

			test(
				'should not move selection if there is no correct location - right arrow',
				'<paragraph>foo</paragraph>[<widget></widget>]',
				keyCodes.arrowright,
				'<paragraph>foo</paragraph>[<widget></widget>]'
			);

			test(
				'should not move selection if there is no correct location - down arrow',
				'<paragraph>foo</paragraph>[<widget></widget>]',
				keyCodes.arrowdown,
				'<paragraph>foo</paragraph>[<widget></widget>]'
			);

			test(
				'should not move selection if there is no correct location - left arrow',
				'[<widget></widget>]<paragraph>foo</paragraph>',
				keyCodes.arrowleft,
				'[<widget></widget>]<paragraph>foo</paragraph>'
			);

			test(
				'should not move selection if there is no correct location - up arrow',
				'[<widget></widget>]<paragraph>foo</paragraph>',
				keyCodes.arrowup,
				'[<widget></widget>]<paragraph>foo</paragraph>'
			);

			test(
				'should do nothing if other key is pressed',
				'[<widget></widget>]<paragraph>foo</paragraph>',
				// Use a safe key (alt) to not trigger the Input features "unsafe keys" handler.
				18,
				'[<widget></widget>]<paragraph>foo</paragraph>'
			);

			it( 'should prevent default behaviour when there is no correct location - document end', () => {
				const keydownHandler = sinon.spy();
				const domEventDataMock = {
					keyCode: keyCodes.arrowright,
					preventDefault: sinon.spy(),
				};
				setModelData( model, '<paragraph>foo</paragraph>[<widget></widget>]' );
				viewDocument.on( 'keydown', keydownHandler );

				viewDocument.fire( 'keydown', domEventDataMock );

				expect( getModelData( model ) ).to.equal( '<paragraph>foo</paragraph>[<widget></widget>]' );
				sinon.assert.calledOnce( domEventDataMock.preventDefault );
				sinon.assert.notCalled( keydownHandler );
			} );

			it( 'should prevent default behaviour when there is no correct location - document start', () => {
				const keydownHandler = sinon.spy();
				const domEventDataMock = {
					keyCode: keyCodes.arrowleft,
					preventDefault: sinon.spy(),
				};
				setModelData( model, '[<widget></widget>]<paragraph>foo</paragraph>' );
				viewDocument.on( 'keydown', keydownHandler );

				viewDocument.fire( 'keydown', domEventDataMock );

				expect( getModelData( model ) ).to.equal( '[<widget></widget>]<paragraph>foo</paragraph>' );
				sinon.assert.calledOnce( domEventDataMock.preventDefault );
				sinon.assert.notCalled( keydownHandler );
			} );

			test(
				'should move selection to object element - right arrow',
				'<paragraph>foo[]</paragraph><widget></widget>',
				keyCodes.arrowright,
				'<paragraph>foo</paragraph>[<widget></widget>]'
			);

			test(
				'should move selection to object element - down arrow',
				'<paragraph>foo[]</paragraph><widget></widget>',
				keyCodes.arrowdown,
				'<paragraph>foo</paragraph>[<widget></widget>]'
			);

			test(
				'should move selection to object element - left arrow',
				'<widget></widget><paragraph>[]foo</paragraph>',
				keyCodes.arrowleft,
				'[<widget></widget>]<paragraph>foo</paragraph>'
			);

			test(
				'should move selection to object element - up arrow',
				'<widget></widget><paragraph>[]foo</paragraph>',
				keyCodes.arrowup,
				'[<widget></widget>]<paragraph>foo</paragraph>'
			);

			test(
				'do nothing on non objects - right arrow',
				'<paragraph>foo[]</paragraph><paragraph>bar</paragraph>',
				keyCodes.arrowright,
				'<paragraph>foo[]</paragraph><paragraph>bar</paragraph>'
			);

			test(
				'do nothing on non objects - down arrow',
				'<paragraph>foo[]</paragraph><paragraph>bar</paragraph>',
				keyCodes.arrowdown,
				'<paragraph>foo[]</paragraph><paragraph>bar</paragraph>'
			);

			test(
				'do nothing on non objects - left arrow',
				'<paragraph>foo</paragraph><paragraph>[]bar</paragraph>',
				keyCodes.arrowleft,
				'<paragraph>foo</paragraph><paragraph>[]bar</paragraph>'
			);

			test(
				'do nothing on non objects - up arrow',
				'<paragraph>foo</paragraph><paragraph>[]bar</paragraph>',
				keyCodes.arrowup,
				'<paragraph>foo</paragraph><paragraph>[]bar</paragraph>'
			);

			test(
				'should work correctly with modifier key: right arrow + ctrl',
				'[<widget></widget>]<paragraph>foo</paragraph>',
				{ keyCode: keyCodes.arrowright, ctrlKey: true },
				'<widget></widget><paragraph>[]foo</paragraph>'
			);

			test(
				'should work correctly with modifier key: right arrow + alt',
				'[<widget></widget>]<paragraph>foo</paragraph>',
				{ keyCode: keyCodes.arrowright, altKey: true },
				'<widget></widget><paragraph>[]foo</paragraph>'
			);

			test(
				'should work correctly with modifier key: right arrow + shift',
				'[<widget></widget>]<paragraph>foo</paragraph>',
				{ keyCode: keyCodes.arrowright, shiftKey: true },
				'<widget></widget><paragraph>[]foo</paragraph>'
			);

			test(
				'should work correctly with modifier key: down arrow + ctrl',
				'[<widget></widget>]<paragraph>foo</paragraph>',
				{ keyCode: keyCodes.arrowdown, ctrlKey: true },
				'<widget></widget><paragraph>[]foo</paragraph>'
			);

			test(
				'should work correctly with modifier key: down arrow + alt',
				'[<widget></widget>]<paragraph>foo</paragraph>',
				{ keyCode: keyCodes.arrowdown, altKey: true },
				'<widget></widget><paragraph>[]foo</paragraph>'
			);

			test(
				'should work correctly with modifier key: down arrow + shift',
				'[<widget></widget>]<paragraph>foo</paragraph>',
				{ keyCode: keyCodes.arrowdown, shiftKey: true },
				'<widget></widget><paragraph>[]foo</paragraph>'
			);

			test(
				'should work correctly with modifier key: left arrow + ctrl',
				'<paragraph>foo</paragraph>[<widget></widget>]',
				{ keyCode: keyCodes.arrowleft, ctrlKey: true },
				'<paragraph>foo[]</paragraph><widget></widget>'
			);

			test(
				'should work correctly with modifier key: left arrow + alt',
				'<paragraph>foo</paragraph>[<widget></widget>]',
				{ keyCode: keyCodes.arrowleft, altKey: true },
				'<paragraph>foo[]</paragraph><widget></widget>'
			);

			test(
				'should work correctly with modifier key: left arrow + shift',
				'<paragraph>foo</paragraph>[<widget></widget>]',
				{ keyCode: keyCodes.arrowleft, shiftKey: true },
				'<paragraph>foo[]</paragraph><widget></widget>'
			);

			test(
				'should work correctly with modifier key: up arrow + ctrl',
				'<paragraph>foo</paragraph>[<widget></widget>]',
				{ keyCode: keyCodes.arrowup, ctrlKey: true },
				'<paragraph>foo[]</paragraph><widget></widget>'
			);

			test(
				'should work correctly with modifier key: up arrow + alt',
				'<paragraph>foo</paragraph>[<widget></widget>]',
				{ keyCode: keyCodes.arrowup, altKey: true },
				'<paragraph>foo[]</paragraph><widget></widget>'
			);

			test(
				'should work correctly with modifier key: up arrow + shift',
				'<paragraph>foo</paragraph>[<widget></widget>]',
				{ keyCode: keyCodes.arrowup, shiftKey: true },
				'<paragraph>foo[]</paragraph><widget></widget>'
			);

			test(
				'should do nothing if there is more than one selection in model',
				'<paragraph>[foo]</paragraph><widget></widget><paragraph>[bar]</paragraph>',
				keyCodes.arrowright,
				'<paragraph>[foo]</paragraph><widget></widget><paragraph>[bar]</paragraph>'
			);

			test(
				'should work if selection is in nested element (left arrow)',

				'<paragraph>foo</paragraph>' +
				'<image></image>' +
				'<blockQuote>' +
					'<div>' +
						'<div>' +
							'<paragraph>[]</paragraph>' +
						'</div>' +
					'</div>' +
				'</blockQuote>' +
				'<paragraph>foo</paragraph>',

				keyCodes.arrowleft,

				'<paragraph>foo</paragraph>' +
				'[<image></image>]' +
				'<blockQuote>' +
					'<div>' +
						'<div>' +
							'<paragraph></paragraph>' +
						'</div>' +
					'</div>' +
				'</blockQuote>' +
				'<paragraph>foo</paragraph>'
			);

			test(
				'should work if selection is in nested element (up arrow)',

				'<paragraph>foo</paragraph>' +
				'<image></image>' +
				'<blockQuote>' +
					'<div>' +
						'<div>' +
							'<paragraph>[]</paragraph>' +
						'</div>' +
					'</div>' +
				'</blockQuote>' +
				'<paragraph>foo</paragraph>',

				keyCodes.arrowup,

				'<paragraph>foo</paragraph>' +
				'[<image></image>]' +
				'<blockQuote>' +
					'<div>' +
						'<div>' +
							'<paragraph></paragraph>' +
						'</div>' +
					'</div>' +
				'</blockQuote>' +
				'<paragraph>foo</paragraph>'
			);

			test(
				'should work if selection is in nested element (right arrow)',

				'<paragraph>foo</paragraph>' +
				'<blockQuote>' +
					'<div>' +
						'<div>' +
							'<paragraph>[]</paragraph>' +
						'</div>' +
					'</div>' +
				'</blockQuote>' +
				'<image></image>' +
				'<paragraph>foo</paragraph>',

				keyCodes.arrowright,

				'<paragraph>foo</paragraph>' +
				'<blockQuote>' +
					'<div>' +
						'<div>' +
							'<paragraph></paragraph>' +
						'</div>' +
					'</div>' +
				'</blockQuote>' +
				'[<image></image>]' +
				'<paragraph>foo</paragraph>'
			);

			test(
				'should work if selection is in nested element (down arrow)',

				'<paragraph>foo</paragraph>' +
				'<blockQuote>' +
					'<div>' +
						'<div>' +
							'<paragraph>[]</paragraph>' +
						'</div>' +
					'</div>' +
				'</blockQuote>' +
				'<image></image>' +
				'<paragraph>foo</paragraph>',

				keyCodes.arrowdown,

				'<paragraph>foo</paragraph>' +
				'<blockQuote>' +
					'<div>' +
						'<div>' +
							'<paragraph></paragraph>' +
						'</div>' +
					'</div>' +
				'</blockQuote>' +
				'[<image></image>]' +
				'<paragraph>foo</paragraph>'
			);
		} );

		describe( 'Ctrl+A', () => {
			test(
				'should select the entire content of the nested editable',
				'<widget><nested>foo[]</nested></widget><paragraph>bar</paragraph>',
				{ keyCode: keyCodes.a, ctrlKey: true },
				'<widget><nested>[foo]</nested></widget><paragraph>bar</paragraph>'
			);

			test(
				'should not change the selection if outside of the nested editable',
				'<widget><nested>foo</nested></widget><paragraph>[]bar</paragraph>',
				{ keyCode: keyCodes.a, ctrlKey: true },
				'<widget><nested>foo</nested></widget><paragraph>[]bar</paragraph>'
			);

			test(
				'should selected whole content when widget is selected',
				'<paragraph>foo</paragraph>[<widget></widget>]<paragraph>bar</paragraph>',
				{ keyCode: keyCodes.a, ctrlKey: true },
				'[<paragraph>foo</paragraph><widget></widget><paragraph>bar</paragraph>]',
				'[<p>foo</p><div class="ck-widget ck-widget_selected" contenteditable="false"><b></b></div><p>bar</p>]'

			);
		} );

		function test( name, data, keyCodeOrMock, expected, expectedView ) {
			it( name, () => {
				const domEventDataMock = ( typeof keyCodeOrMock == 'object' ) ? keyCodeOrMock : {
					keyCode: keyCodeOrMock
				};

				setModelData( model, data );
				viewDocument.fire( 'keydown', new DomEventData(
					viewDocument,
					{ target: document.createElement( 'div' ), preventDefault() {} },
					domEventDataMock
				) );

				expect( getModelData( model ) ).to.equal( expected );

				if ( expectedView ) {
					expect( getViewData( viewDocument ) ).to.equal( expectedView );
				}
			} );
		}
	} );

	describe( 'delete integration', () => {
		function test( name, input, direction, expected ) {
			it( name, () => {
				setModelData( model, input );
				const scrollStub = sinon.stub( viewDocument, 'scrollToTheSelection' );
				const domEventDataMock = {
					keyCode: direction == 'backward' ? keyCodes.backspace : keyCodes.delete,
				};

				viewDocument.fire( 'keydown', new DomEventData(
					viewDocument,
					{ target: document.createElement( 'div' ), preventDefault() {} },
					domEventDataMock
				) );

				expect( getModelData( model ) ).to.equal( expected );
				scrollStub.restore();
			} );
		}

		// Let's make this integration tests real which will help covering
		// cases like https://github.com/ckeditor/ckeditor5/issues/753.
		// Originally, this test file used the Delete feature only which was not "integrational" enough.
		it( 'tests are executed with the Typing feature', () => {
			expect( editor.plugins.get( 'Typing' ) ).to.not.be.undefined;
		} );

		test(
			'should select widget when backspace is pressed',
			'<widget></widget><paragraph>[]foo</paragraph>',
			'backward',
			'[<widget></widget>]<paragraph>foo</paragraph>'
		);

		test(
			'should remove empty element after selecting widget when backspace is pressed',
			'<widget></widget><paragraph>[]</paragraph>',
			'backward',
			'[<widget></widget>]'
		);

		test(
			'should select widget when delete is pressed',
			'<paragraph>foo[]</paragraph><widget></widget>',
			'forward',
			'<paragraph>foo</paragraph>[<widget></widget>]'
		);

		test(
			'should remove empty element after selecting widget when delete is pressed',
			'<paragraph>[]</paragraph><widget></widget>',
			'forward',
			'[<widget></widget>]'
		);

		test(
			'should not select widget on non-collapsed selection',
			'<widget></widget><paragraph>[f]oo</paragraph>',
			'backward',
			'<widget></widget><paragraph>[]oo</paragraph>'
		);

		test(
			'should not affect non-object elements',
			'<paragraph>foo</paragraph><paragraph>[]bar</paragraph>',
			'backward',
			'<paragraph>foo[]bar</paragraph>'
		);

		test(
			'should not modify backward delete default behaviour in single paragraph boundaries',
			'<paragraph>[]foo</paragraph>',
			'backward',
			'<paragraph>[]foo</paragraph>'
		);

		test(
			'should not modify forward delete default behaviour in single paragraph boundaries',
			'<paragraph>foo[]</paragraph>',
			'forward',
			'<paragraph>foo[]</paragraph>'
		);

		test(
			'should delete selected widget with paragraph before - backward',
			'<paragraph>foo</paragraph>[<widget></widget>]',
			'backward',
			'<paragraph>foo</paragraph><paragraph>[]</paragraph>'
		);

		test(
			'should delete selected widget with paragraph before - forward',
			'<paragraph>foo</paragraph>[<widget></widget>]',
			'forward',
			'<paragraph>foo</paragraph><paragraph>[]</paragraph>'
		);

		test(
			'should delete selected widget with paragraph after - backward',
			'[<widget></widget>]<paragraph>foo</paragraph>',
			'backward',
			'<paragraph>[]</paragraph><paragraph>foo</paragraph>'
		);

		test(
			'should delete selected widget with paragraph after - forward',
			'[<widget></widget>]<paragraph>foo</paragraph>',
			'forward',
			'<paragraph>[]</paragraph><paragraph>foo</paragraph>'
		);

		test(
			'should delete selected widget between paragraphs - backward',
			'<paragraph>bar</paragraph>[<widget></widget>]<paragraph>foo</paragraph>',
			'backward',
			'<paragraph>bar</paragraph><paragraph>[]</paragraph><paragraph>foo</paragraph>'
		);

		test(
			'should delete selected widget between paragraphs - forward',
			'<paragraph>bar</paragraph>[<widget></widget>]<paragraph>foo</paragraph>',
			'forward',
			'<paragraph>bar</paragraph><paragraph>[]</paragraph><paragraph>foo</paragraph>'
		);

		test(
			'should delete selected widget preceded by another widget - backward',
			'<widget></widget>[<widget></widget>]',
			'backward',
			'<widget></widget><paragraph>[]</paragraph>'
		);

		test(
			'should delete selected widget preceded by another widget - forward',
			'<widget></widget>[<widget></widget>]',
			'forward',
			'<widget></widget><paragraph>[]</paragraph>'
		);

		test(
			'should delete selected widget before another widget - forward',
			'[<widget></widget>]<widget></widget>',
			'forward',
			'<paragraph>[]</paragraph><widget></widget>'
		);

		test(
			'should delete selected widget before another widget - backward',
			'[<widget></widget>]<widget></widget>',
			'backward',
			'<paragraph>[]</paragraph><widget></widget>'
		);

		test(
			'should delete selected widget between other widgets - forward',
			'<widget></widget>[<widget></widget>]<widget></widget>',
			'forward',
			'<widget></widget><paragraph>[]</paragraph><widget></widget>'
		);

		test(
			'should delete selected widget between other widgets - backward',
			'<widget></widget>[<widget></widget>]<widget></widget>',
			'backward',
			'<widget></widget><paragraph>[]</paragraph><widget></widget>'
		);

		test(
			'should select inline objects - backward',
			'<paragraph>foo<inline></inline>[]bar</paragraph>',
			'backward',
			'<paragraph>foo[<inline></inline>]bar</paragraph>'
		);

		test(
			'should select inline objects - forward',
			'<paragraph>foo[]<inline></inline>bar</paragraph>',
			'forward',
			'<paragraph>foo[<inline></inline>]bar</paragraph>'
		);

		test(
			'should delete selected inline objects - backward',
			'<paragraph>foo[<inline></inline>]bar</paragraph>',
			'backward',
			'<paragraph>foo[]bar</paragraph>'
		);

		test(
			'should delete selected inline objects - forward',
			'<paragraph>foo[<inline></inline>]bar</paragraph>',
			'forward',
			'<paragraph>foo[]bar</paragraph>'
		);

		test(
			'should use standard delete behaviour when after first letter - backward',
			'<paragraph>a[]</paragraph>',
			'backward',
			'<paragraph>[]</paragraph>'
		);

		test(
			'should use standard delete behaviour when before first letter - forward',
			'<paragraph>[]a</paragraph>',
			'forward',
			'<paragraph>[]</paragraph>'
		);

		it( 'should prevent default behaviour and stop event propagation', () => {
			setModelData( model, '<paragraph>foo[]</paragraph><widget></widget>' );
			const scrollStub = sinon.stub( viewDocument, 'scrollToTheSelection' );
			const deleteSpy = sinon.spy();

			viewDocument.on( 'delete', deleteSpy );
			const domEventDataMock = { target: document.createElement( 'div' ), preventDefault: sinon.spy() };

			viewDocument.fire( 'delete', new DomEventData(
				viewDocument,
				domEventDataMock,
				{ direction: 'forward', unit: 'character', sequence: 0 }
			) );

			sinon.assert.calledOnce( domEventDataMock.preventDefault );
			sinon.assert.notCalled( deleteSpy );
			scrollStub.restore();
		} );

		test(
			'should remove the entire empty element if it is next to a widget',

			'<paragraph>foo</paragraph>' +
			'<image></image>' +
			'<blockQuote><paragraph>[]</paragraph></blockQuote>' +
			'<paragraph>foo</paragraph>',

			'backward',

			'<paragraph>foo</paragraph>[<image></image>]<paragraph>foo</paragraph>'
		);

		test(
			'should remove the entire empty element (deeper structure) if it is next to a widget',

			'<paragraph>foo</paragraph>' +
			'<image></image>' +
			'<blockQuote><div><div><paragraph>[]</paragraph></div></div></blockQuote>' +
			'<paragraph>foo</paragraph>',

			'backward',

			'<paragraph>foo</paragraph>' +
			'[<image></image>]' +
			'<paragraph>foo</paragraph>'
		);

		test(
			'should remove the entire empty element (deeper structure) if it is next to a widget (forward delete)',

			'<paragraph>foo</paragraph>' +
			'<blockQuote><div><div><paragraph>[]</paragraph></div></div></blockQuote>' +
			'<image></image>' +
			'<paragraph>foo</paragraph>',

			'forward',

			'<paragraph>foo</paragraph>' +
			'[<image></image>]' +
			'<paragraph>foo</paragraph>'
		);

		test(
			'should not remove the entire element which is not empty and the element is next to a widget',

			'<paragraph>foo</paragraph>' +
			'<image></image>' +
			'<blockQuote><paragraph>[]</paragraph><paragraph></paragraph></blockQuote>' +
			'<paragraph>foo</paragraph>',

			'backward',

			'<paragraph>foo</paragraph>' +
			'[<image></image>]' +
			'<blockQuote><paragraph></paragraph></blockQuote>' +
			'<paragraph>foo</paragraph>'
		);

		test(
			'should not remove the entire element which is not empty and the element is next to a widget (forward delete)',

			'<paragraph>foo</paragraph>' +
			'<blockQuote><paragraph>Foo</paragraph><paragraph>[]</paragraph></blockQuote>' +
			'<image></image>' +
			'<paragraph>foo</paragraph>',

			'forward',

			'<paragraph>foo</paragraph>' +
			'<blockQuote><paragraph>Foo</paragraph></blockQuote>' +
			'[<image></image>]' +
			'<paragraph>foo</paragraph>'
		);

		test(
			'should not remove the entire element (deeper structure) which is not empty and the element is next to a widget',

			'<paragraph>foo</paragraph>' +
			'<image></image>' +
			'<blockQuote>' +
			'<div>' +
			'<div>' +
			'<paragraph>[]</paragraph>' +
			'</div>' +
			'</div>' +
			'<paragraph></paragraph>' +
			'</blockQuote>' +
			'<paragraph>foo</paragraph>',

			'backward',

			'<paragraph>foo</paragraph>' +
			'[<image></image>]' +
			'<blockQuote>' +
			'<paragraph></paragraph>' +
			'</blockQuote>' +
			'<paragraph>foo</paragraph>'
		);

		test(
			'should do nothing if the nested element is not empty and the element is next to a widget',

			'<paragraph>foo</paragraph>' +
			'<image></image>' +
			'<blockQuote>' +
			'<div>' +
			'<div>' +
			'<paragraph>Foo[]</paragraph>' +
			'</div>' +
			'</div>' +
			'</blockQuote>' +
			'<paragraph>foo</paragraph>',

			'backward',

			'<paragraph>foo</paragraph>' +
			'<image></image>' +
			'<blockQuote>' +
			'<div>' +
			'<div>' +
			'<paragraph>Fo[]</paragraph>' +
			'</div>' +
			'</div>' +
			'</blockQuote>' +
			'<paragraph>foo</paragraph>'
		);

		it( 'does nothing when editor when read only mode is enabled (delete)', () => {
			const scrollStub = sinon.stub( viewDocument, 'scrollToTheSelection' );
			setModelData( model,
				'<paragraph>foo</paragraph>' +
				'<image></image>' +
				'<blockQuote><paragraph>[]</paragraph></blockQuote>' +
				'<paragraph>foo</paragraph>'
			);

			editor.isReadOnly = true;

			const domEventDataMock = { target: document.createElement( 'div' ), preventDefault: sinon.spy() };

			viewDocument.fire( 'delete', new DomEventData(
				viewDocument,
				domEventDataMock,
				{ direction: 'backward', unit: 'character', sequence: 0 }
			) );

			expect( getModelData( model ) ).to.equal(
				'<paragraph>foo</paragraph>' +
				'<image></image>' +
				'<blockQuote><paragraph>[]</paragraph></blockQuote>' +
				'<paragraph>foo</paragraph>'
			);
			scrollStub.restore();
		} );

		it( 'does nothing when editor when read only mode is enabled (forward delete)', () => {
			const scrollStub = sinon.stub( viewDocument, 'scrollToTheSelection' );
			setModelData( model,
				'<paragraph>foo</paragraph>' +
				'<image></image>' +
				'<blockQuote><paragraph>[]</paragraph></blockQuote>' +
				'<paragraph>foo</paragraph>'
			);

			editor.isReadOnly = true;

			const domEventDataMock = { target: document.createElement( 'div' ), preventDefault: sinon.spy() };

			viewDocument.fire( 'delete', new DomEventData(
				viewDocument,
				domEventDataMock,
				{ direction: 'forward', unit: 'character', sequence: 0 }
			) );

			expect( getModelData( model ) ).to.equal(
				'<paragraph>foo</paragraph>' +
				'<image></image>' +
				'<blockQuote><paragraph>[]</paragraph></blockQuote>' +
				'<paragraph>foo</paragraph>'
			);
			scrollStub.restore();
		} );
	} );
} );
