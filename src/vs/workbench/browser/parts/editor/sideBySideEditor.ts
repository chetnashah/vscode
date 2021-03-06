/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/sidebysideEditor';
import { TPromise } from 'vs/base/common/winjs.base';
import * as strings from 'vs/base/common/strings';
import * as DOM from 'vs/base/browser/dom';
import { Dimension, Builder } from 'vs/base/browser/builder';

import { Registry } from 'vs/platform/platform';
import { IEditorRegistry, Extensions as EditorExtensions, EditorInput, EditorOptions, SideBySideEditorInput } from 'vs/workbench/common/editor';
import { BaseEditor, EditorDescriptor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { IEditorControl, Position } from 'vs/platform/editor/common/editor';
import { VSash } from 'vs/base/browser/ui/sash/sash';

import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';

export class SideBySideEditor extends BaseEditor {

	public static ID: string = 'workbench.editor.sidebysideEditor';

	private dimension: Dimension;

	private masterEditor: BaseEditor;
	private masterEditorContainer: HTMLElement;

	private detailsEditor: BaseEditor;
	private detailsEditorContainer: HTMLElement;

	private sash: VSash;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService
	) {
		super(SideBySideEditor.ID, telemetryService);
	}

	public createEditor(parent: Builder): void {
		const parentElement = parent.getHTMLElement();
		DOM.addClass(parentElement, 'side-by-side-editor');
		this.createSash(parentElement);
	}

	public setInput(newInput: SideBySideEditorInput, options?: EditorOptions): TPromise<void> {
		const oldInput = <SideBySideEditorInput>this.getInput();
		return super.setInput(newInput, options)
			.then(() => this.updateInput(oldInput, newInput, options));
	}

	public setEditorVisible(visible: boolean, position: Position): void {
		if (this.masterEditor) {
			this.masterEditor.setVisible(visible);
		}
		if (this.detailsEditor) {
			this.detailsEditor.setVisible(visible);
		}
		super.setEditorVisible(visible, position);
	}

	public clearInput(): void {
		this.disposeEditors();
		super.clearInput();
	}

	public focus(): void {
		if (this.masterEditor) {
			this.masterEditor.focus();
		}
	}

	public layout(dimension: Dimension): void {
		this.dimension = dimension;
		this.sash.setDimenesion(this.dimension);
	}

	public getControl(): IEditorControl {
		if (this.masterEditor) {
			return this.masterEditor.getControl();
		}
		return null;
	}

	private updateInput(oldInput: SideBySideEditorInput, newInput: SideBySideEditorInput, options?: EditorOptions): TPromise<void> {
		if (!newInput.matches(oldInput)) {
			if (oldInput) {
				this.disposeEditors();
			}
			this.createEditorContainers();
			return this.setNewInput(newInput, options);
		} else {
			this.detailsEditor.setInput(newInput.details);
			this.masterEditor.setInput(newInput.master, options);
		}
	}

	private setNewInput(newInput: SideBySideEditorInput, options?: EditorOptions): TPromise<void> {
		return TPromise.join([
			this._createEditor(<EditorInput>newInput.details, this.detailsEditorContainer),
			this._createEditor(<EditorInput>newInput.master, this.masterEditorContainer, options)
		]).then(result => this.onEditorsCreated(result[0], result[1]));
	}

	private _createEditor(editorInput: EditorInput, container: HTMLElement, options?: EditorOptions): TPromise<BaseEditor> {
		const descriptor = Registry.as<IEditorRegistry>(EditorExtensions.Editors).getEditor(editorInput);
		if (!descriptor) {
			return TPromise.wrapError(new Error(strings.format('Can not find a registered editor for the input {0}', editorInput)));
		}
		return this.instantiationService.createInstance(<EditorDescriptor>descriptor)
			.then((editor: BaseEditor) => {
				editor.create(new Builder(container));
				return editor.setInput(editorInput, options).then(() => editor);
			});
	}

	private onEditorsCreated(details: BaseEditor, master: BaseEditor): void {
		this.detailsEditor = details;
		this.masterEditor = master;
		this.setEditorVisible(this.isVisible(), this.position);
		this.dolayout(this.sash.getVerticalSashLeft());
		this.focus();
	}

	private createEditorContainers(): void {
		const parentElement = this.getContainer().getHTMLElement();
		this.detailsEditorContainer = DOM.append(parentElement, DOM.$('.details-editor-container'));
		this.detailsEditorContainer.style.position = 'absolute';
		this.masterEditorContainer = DOM.append(parentElement, DOM.$('.master-editor-container'));
		this.masterEditorContainer.style.position = 'absolute';
	}

	private createSash(parentElement: HTMLElement): void {
		this.sash = this._register(new VSash(parentElement, 220));
		this._register(this.sash.onPositionChange(position => this.dolayout(position)));
	}

	private dolayout(splitPoint: number): void {
		if (!this.detailsEditor || !this.masterEditor) {
			return;
		}
		const masterEditorWidth = this.dimension.width - splitPoint;
		const detailsEditorWidth = this.dimension.width - masterEditorWidth;

		this.detailsEditorContainer.style.width = `${detailsEditorWidth}px`;
		this.detailsEditorContainer.style.height = `${this.dimension.height}px`;
		this.detailsEditorContainer.style.left = '0px';

		this.masterEditorContainer.style.width = `${masterEditorWidth}px`;
		this.masterEditorContainer.style.height = `${this.dimension.height}px`;
		this.masterEditorContainer.style.left = `${splitPoint}px`;

		this.detailsEditor.layout(new Dimension(detailsEditorWidth, this.dimension.height));
		this.masterEditor.layout(new Dimension(masterEditorWidth, this.dimension.height));
	}

	private disposeEditors(): void {
		const parentContainer = this.getContainer().getHTMLElement();
		if (this.detailsEditor) {
			this.detailsEditor.dispose();
			this.detailsEditor = null;
		}
		if (this.masterEditor) {
			this.masterEditor.dispose();
			this.detailsEditor = null;
		}
		if (this.detailsEditorContainer) {
			parentContainer.removeChild(this.detailsEditorContainer);
			this.detailsEditorContainer = null;
		}
		if (this.masterEditorContainer) {
			parentContainer.removeChild(this.masterEditorContainer);
			this.masterEditorContainer = null;
		}
	}
}