/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Notification */

import * as React from "react";
import * as classnames from "classnames";
import * as _ from "lodash";

import {
  ActivityMessageDetails,
  NotifyMessageDetails,
  OutputMessagePriority,
  MessageBoxType,
  MessageBoxIconType,
  MessageBoxValue,
  OutputMessageType,
  OutputMessageAlert,
  ToolAssistanceInstructions,
} from "@bentley/imodeljs-frontend";
import { UiEvent, MessageContainer, MessageSeverity } from "@bentley/ui-core";
import { UiFramework } from "../UiFramework";
import { ModalDialogManager } from "../dialog/ModalDialogManager";
import { StandardMessageBox } from "../dialog/StandardMessageBox";
import { ConfigurableUiActionId } from "../configurableui/state";
import { MessageSpan } from "./MessageSpan";

class MessageBoxCallbacks {
  constructor(
    public readonly onFulfilled: (result: MessageBoxValue) => void,
    public readonly onRejected: (result: any) => void,
  ) { }

  public handleMessageBoxResult = (result: MessageBoxValue) => {
    this.onFulfilled(result);
  }
}

/** [[MessageAddedEvent]] arguments.
 * @public
 */
export interface MessageAddedEventArgs {
  message: NotifyMessageDetails;
}

/** Activity Message Event arguments.
 * @public
 */
export interface ActivityMessageEventArgs {
  message: HTMLElement | string;
  percentage: number;
  details?: ActivityMessageDetails;
  restored?: boolean;
}

/** Input Field Message Event arguments.
 * @public
 */
export interface InputFieldMessageEventArgs {
  target: Element;
  messageText: HTMLElement | string;
  detailedMessage: HTMLElement | string;
  priority: OutputMessagePriority;
}

/** Tool Assistance Changed event arguments.
 * @alpha
 */
export interface ToolAssistanceChangedEventArgs {
  instructions: ToolAssistanceInstructions | undefined;
}

/** Message Added Event class.
 * @public
 */
export class MessageAddedEvent extends UiEvent<MessageAddedEventArgs> { }

/** Activity Message Added Event class.
 * @public
 */
export class ActivityMessageUpdatedEvent extends UiEvent<ActivityMessageEventArgs> { }

/** Activity Message Cancelled Event class.
 * @public
 */
export class ActivityMessageCancelledEvent extends UiEvent<{}> { }

/** Input Field Message Added Event class
 * @public
 */
export class InputFieldMessageAddedEvent extends UiEvent<InputFieldMessageEventArgs> { }

/** Input Field Message Removed Event class.
 * @public
 */
export class InputFieldMessageRemovedEvent extends UiEvent<{}> { }

/** Tool Assistance Changed event class
 * @alpha
 */
export class ToolAssistanceChangedEvent extends UiEvent<ToolAssistanceChangedEventArgs> { }

/**
 * Keeps track of the current activity message, and updates whenever
 * setupActivityMessageDetails() or setupActivityMessageValues()
 * is called.
 * Used to display tracked progress in ActivityMessage.
 */
class OngoingActivityMessage {
  public message: HTMLElement | string = "";
  public percentage: number = 0;
  public details: ActivityMessageDetails = new ActivityMessageDetails(true, true, true);
  public isRestored: boolean = false;
}

/** The MessageManager class manages messages and prompts. It is used by the [[AppNotificationManager]] class.
 * @public
 */
export class MessageManager {
  private static _maxCachedMessages = 500;
  private static _messages: NotifyMessageDetails[] = new Array<NotifyMessageDetails>();
  private static _OngoingActivityMessage: OngoingActivityMessage = new OngoingActivityMessage();
  private static _lastMessage?: NotifyMessageDetails;

  /** The MessageAddedEvent is fired when a message is added via IModelApp.notifications.outputMessage(). */
  public static readonly onMessageAddedEvent = new MessageAddedEvent();

  /** The ActivityMessageUpdatedEvent is fired when an Activity message updates via IModelApp.notifications.outputActivityMessage(). */
  public static readonly onActivityMessageUpdatedEvent = new ActivityMessageUpdatedEvent();

  /** The ActivityMessageCancelledEvent is fired when an Activity message is cancelled via
   * IModelApp.notifications.endActivityMessage(ActivityMessageEndReason.Cancelled) or
   * by the user clicking the 'Cancel' link.
   */
  public static readonly onActivityMessageCancelledEvent = new ActivityMessageCancelledEvent();

  public static readonly onInputFieldMessageAddedEvent = new InputFieldMessageAddedEvent();
  public static readonly onInputFieldMessageRemovedEvent = new InputFieldMessageRemovedEvent();

  /** The ToolAssistanceChangedEvent is fired when a tool calls IModelApp.notifications.setToolAssistance().
   * @alpha
   */
  public static readonly onToolAssistanceChangedEvent = new ToolAssistanceChangedEvent();

  /** List of messages as NotifyMessageDetails. */
  public static get messages(): Readonly<NotifyMessageDetails[]> { return this._messages; }

  /** Clear the message list. */
  public static clearMessages(): void {
    this._messages.splice(0);
    this._lastMessage = undefined;
  }

  /** Set the maximum number of cached message. */
  public static setMaxCachedMessages(max: number): void {
    this._maxCachedMessages = max;
    this.checkMaxCachedMessages();
  }

  /** Output a message and/or alert to the user.
   * @param  message  Details about the message to output.
   */
  public static addMessage(message: NotifyMessageDetails): void {
    if (!_.isEqual(message, this._lastMessage)) {
      this.addToMessageCenter(message);
      this._lastMessage = message;
    }

    if (message.msgType === OutputMessageType.Alert) {
      if (message.openAlert === OutputMessageAlert.Balloon)
        message.msgType = OutputMessageType.Sticky; // Note: Changing the message.msgType here for Balloon
      else
        this.showAlertMessageBox(message);
    }

    this.onMessageAddedEvent.emit({ message });
  }

  /** Add a message to the Message Center.
   * @param  message  Details about the message to output.
   */
  public static addToMessageCenter(message: NotifyMessageDetails): void {
    this._messages.push(message);
    this.checkMaxCachedMessages();
  }

  /** Checks number of messages against the maximum. */
  private static checkMaxCachedMessages(): void {
    if (this._messages.length > this._maxCachedMessages) {
      const numToErase = this._maxCachedMessages / 4;
      this._messages.splice(0, numToErase);
    }
  }

  /**
   * Sets details for setting up an Activity message.
   * @param details    Details for setup of ActivityMessage
   * @returns true if details is valid and can be used to display ActivityMessage
   */
  public static setupActivityMessageDetails(details: ActivityMessageDetails): boolean {
    this._OngoingActivityMessage.details = details;
    this._OngoingActivityMessage.isRestored = details.showDialogInitially;
    return true;
  }

  /**
   * Sets values on _OngoingActivityMessage to be referenced when displaying
   * an ActivityMessage.
   * @param message     Message of the process that ActivityMessage is tracking
   * @param percentage  Progress made by activity in percentage
   * @param restored    True if original ActivityMessage has been closed and
   *                    is now being restored from the status bar.
   * @returns true if details is valid and can be used to display ActivityMessage
   */
  public static setupActivityMessageValues(message: HTMLElement | string, percentage: number, restored?: boolean): boolean {
    this._OngoingActivityMessage.message = message;
    this._OngoingActivityMessage.percentage = percentage;

    this.onActivityMessageUpdatedEvent.emit({
      message,
      percentage,
      details: this._OngoingActivityMessage.details,
      restored: (restored !== undefined) ? restored : this._OngoingActivityMessage.isRestored,
    });

    this._OngoingActivityMessage.isRestored = false;

    return true;
  }

  /**
   * Dismisses current ActivityMessage and ends activity if canceled.
   * @param isCompleted   True if the activity was completed, false if it was canceled
   * @returns True if both ActivityMessage and activity process are ended.
   */
  public static endActivityMessage(isCompleted: boolean): boolean {
    this.endActivityProcessing(isCompleted);
    this.onActivityMessageCancelledEvent.emit({});
    return true;
  }

  /**
   * Ends processing for activity according to message definition.
   * @param isCompleted   True if the activity was completed, false if it was canceled
   */
  private static endActivityProcessing(isCompleted: boolean): void {
    if (isCompleted)
      this._OngoingActivityMessage.details.onActivityCompleted();
    else
      this._OngoingActivityMessage.details.onActivityCancelled();
  }

  /**
   * Displays an input field message near target element.
   * @param target  The currently focused or recently focused element to place the
   *                input field message near.
   * @param messageText  Text to display in the message.
   * @param detailedMessage   Optional detailed message text to display.
   * @param priority   Optional message priority which controls icon to display.
   */
  public static displayInputFieldMessage(target: HTMLElement, messageText: HTMLElement | string, detailedMessage: HTMLElement | string = "", priority = OutputMessagePriority.Error) {
    this.onInputFieldMessageAddedEvent.emit({
      target,
      messageText,
      detailedMessage,
      priority,
    });
  }

  /**
   * Hides the currently displayed input field message.
   */
  public static hideInputFieldMessage() {
    this.onInputFieldMessageRemovedEvent.emit({});
  }

  /** Output a prompt to the user. A 'prompt' indicates an action the user should take to proceed. */
  public static outputPrompt(prompt: string): void {
    UiFramework.dispatchActionToStore(ConfigurableUiActionId.SetToolPrompt, prompt, true);
  }

  /** Gets an icon CSS class name based on a given NotifyMessageDetails. */
  public static getIconClassName(details: NotifyMessageDetails): string {
    const severity = MessageManager.getSeverity(details);
    const className = MessageContainer.getIconClassName(severity, false);
    const iconClassName = classnames("icon", "notifymessage-icon", className);

    return iconClassName;
  }

  /** Gets a [[MessageSeverity]] based on a given NotifyMessageDetails. */
  public static getSeverity(details: NotifyMessageDetails): MessageSeverity {
    let severity = MessageSeverity.None;

    switch (details.priority) {
      case OutputMessagePriority.None:
        severity = MessageSeverity.None;
        break;
      case OutputMessagePriority.Info:
        severity = MessageSeverity.Information;
        break;
      case OutputMessagePriority.Warning:
        severity = MessageSeverity.Warning;
        break;
      case OutputMessagePriority.Error:
        severity = MessageSeverity.Error;
        break;
      case OutputMessagePriority.Fatal:
        severity = MessageSeverity.Fatal;
        break;
    }

    return severity;
  }

  /** Gets a MessageBoxIconType based on a given NotifyMessageDetails. */
  public static getIconType(details: NotifyMessageDetails): MessageBoxIconType {
    let iconType = MessageBoxIconType.NoSymbol;

    switch (details.priority) {
      case OutputMessagePriority.None:
        iconType = MessageBoxIconType.NoSymbol;
        break;
      case OutputMessagePriority.Info:
        iconType = MessageBoxIconType.Information;
        break;
      case OutputMessagePriority.Warning:
        iconType = MessageBoxIconType.Warning;
        break;
      case OutputMessagePriority.Error:
        iconType = MessageBoxIconType.Critical;
        break;
      case OutputMessagePriority.Fatal:
        iconType = MessageBoxIconType.Critical;
        break;
    }

    return iconType;
  }

  /** Output a MessageBox and wait for response from the user.
   * @param mbType       The MessageBox type.
   * @param message      The message to display.
   * @param icon         The MessageBox icon type.
   * @return the response from the user.
   */
  public static async openMessageBox(mbType: MessageBoxType, message: HTMLElement | string, icon: MessageBoxIconType): Promise<MessageBoxValue> {
    const title = UiFramework.translate("general.alert");

    return new Promise((onFulfilled: (result: MessageBoxValue) => void, onRejected: (reason: any) => void) => {
      const messageBoxCallbacks = new MessageBoxCallbacks(onFulfilled, onRejected);
      const messageElement = <MessageSpan message={message} />;
      ModalDialogManager.openDialog(this.standardMessageBox(mbType, icon, title, messageElement, messageBoxCallbacks));
    });
  }

  /** @internal */
  public static showAlertMessageBox(messageDetails: NotifyMessageDetails): void {
    const title = UiFramework.translate("general.alert");
    const iconType = this.getIconType(messageDetails);
    const content = (
      <>
        <MessageSpan message={messageDetails.briefMessage} />
        {
          messageDetails.detailedMessage && (
            <p>
              <MessageSpan message={messageDetails.detailedMessage} />
            </p>
          )
        }
      </>
    );
    ModalDialogManager.openDialog(this.standardMessageBox(MessageBoxType.Ok, iconType, title, content));
  }

  private static standardMessageBox(mbType: MessageBoxType, iconType: MessageBoxIconType, title: string, messageElement: React.ReactNode, callbacks?: MessageBoxCallbacks): React.ReactNode {
    const onResult = (callbacks !== undefined) ? callbacks.handleMessageBoxResult : undefined;
    return (
      <StandardMessageBox
        opened={true}
        messageBoxType={mbType}
        iconType={iconType}
        title={title}
        onResult={onResult}
      >
        {messageElement}
      </StandardMessageBox>
    );
  }

  /** Setup tool assistance instructions for a tool. The instructions include the main instruction, which includes the current prompt.
   * @param instructions The tool assistance instructions.
   * @alpha
   */
  public static setToolAssistance(instructions: ToolAssistanceInstructions | undefined) {
    MessageManager.onToolAssistanceChangedEvent.emit({ instructions });
  }

}
