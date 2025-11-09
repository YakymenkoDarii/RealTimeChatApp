import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { HubConnection, HubConnectionBuilder } from '@microsoft/signalr';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { MessageRequest, MessageResponse, OnlineUser } from '../models/chat.models';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private hubConnection: HubConnection | undefined;
  private chatUrl = `${environment.apiUrl}/chathub`;

  public onlineUsers$ = new BehaviorSubject<OnlineUser[]>([]);
  public messages$ = new BehaviorSubject<MessageResponse[]>([]);
  public typing$ = new Subject<{ user: string, isTyping: boolean }>();
  public notification$ = new Subject<OnlineUser>();
  public messagesLoaded$ = new Subject<number>();
  public onMessageReceived$ = new Subject<MessageResponse>();

  constructor(private authService: AuthService) { }

  public startConnection(receiverId?: string): Promise<void> {
    if (this.hubConnection) {
      return Promise.resolve();
    }

    let url = this.chatUrl;
    if (receiverId) {
      url += `?senderId=${receiverId}`;
    }

    this.hubConnection = new HubConnectionBuilder()
      .withUrl(url, {
        accessTokenFactory: () => this.authService.getToken()!
      })
      .withAutomaticReconnect()
      .build();

    return this.hubConnection.start()
      .then(() => {
        console.log('SignalR Connection Started.');
        this.registerListeners();
      })
      .catch(err => {
        console.error('Error while starting connection: ' + err);
        throw err;
      });
  }

  public stopConnection(): void {
    this.hubConnection?.stop()
      .then(() => {
        console.log('SignalR Connection Stopped.');
      })
      .catch(err => console.error('Error stopping connection: ', err))
      .finally(() => {
        this.hubConnection = undefined;
      });
  }

  private registerListeners(): void {
    if (!this.hubConnection) return;

    this.hubConnection.on("OnlineUsers", (users: OnlineUser[]) => {
      const currentUsername = this.authService.currentUserName;
      const filteredUsers = users.filter(u => u.userName !== currentUsername);
      this.onlineUsers$.next(filteredUsers);
    });

    this.hubConnection.on("ReceiveMessage", (message: MessageResponse) => {
      this.onMessageReceived$.next(message);
    });

    this.hubConnection.on("ReceiveMessageList", (messages: MessageResponse[]) => {
      this.messages$.next([...this.messages$.getValue(), ...messages]);
      this.messagesLoaded$.next(messages.length);
    });

    this.hubConnection.on("NotifyTypingToUser", (senderUserName: string) => {
      this.typing$.next({ user: senderUserName, isTyping: true });
      setTimeout(() => {
        this.typing$.next({ user: senderUserName, isTyping: false });
      }, 3000);
    });

    this.hubConnection.on("Notify", (user: OnlineUser) => {
      this.notification$.next(user);
      console.log('New user notification:', user);
    });
  }

  public async sendMessage(message: MessageRequest): Promise<void> {
    try {
      await this.hubConnection?.invoke("SendMessage", message);
    } catch (err) {
      console.error('Error invoking SendMessage:', err);
    }
  }

  public async notifyTyping(recipientUserName: string): Promise<void> {
    try {
      await this.hubConnection?.invoke("NotifyTyping", recipientUserName);
    } catch (err) {
      console.error('Error invoking NotifyTyping:', err);
    }
  }

  public async loadMessages(recipientId: string, pageNumber: number = 1): Promise<void> {
    if (this.hubConnection?.state !== signalR.HubConnectionState.Connected) {
      console.warn('Cannot load messages, connection is not active.');
      return;
    }
    try {
      await this.hubConnection?.invoke("LoadMessages", recipientId, pageNumber);
    } catch (err) {
      console.error('Error invoking LoadMessages:', err);
    }
  }
}
