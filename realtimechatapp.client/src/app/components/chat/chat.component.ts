import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { Observable, Subscription } from 'rxjs';
import { OnlineUser, MessageResponse, MessageRequest } from '../../models/chat.models';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat',
  standalone: true,
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css'],
  imports: [
    CommonModule,
    FormsModule
  ]
})
export class ChatComponent implements OnInit, OnDestroy {

  public onlineUsers$: Observable<OnlineUser[]>;
  public messages$: Observable<MessageResponse[]>;
  public typing$: Observable<any>;

  public selectedUser: OnlineUser | null = null;
  public messageContent: string = '';

  private connectionPromise: Promise<void> | undefined;

  @ViewChild('messageList') private messageList: ElementRef | undefined;
  public isLoading = false;
  private pageNumber = 1;
  private hasMoreMessages = true;
  private messagesLoadedSubscription: Subscription | undefined;
  private newMessageSubscription: Subscription | undefined;
  private previousScrollHeight = 0;

  constructor(
    private authService: AuthService,
    public chatService: ChatService
  ) {
    this.onlineUsers$ = this.chatService.onlineUsers$.asObservable();
    this.messages$ = this.chatService.messages$.asObservable();
    this.typing$ = this.chatService.typing$.asObservable();
  }

  ngOnInit(): void {
    this.connectionPromise = this.chatService.startConnection();

    this.messagesLoadedSubscription = this.chatService.messagesLoaded$.subscribe((messagesCount: number) => {
      this.isLoading = false;
      if (messagesCount < 10) {
        this.hasMoreMessages = false;
      }
      if (this.messageList) {
        const el = this.messageList.nativeElement;
        const newScrollHeight = el.scrollHeight;
        el.scrollTop = newScrollHeight - this.previousScrollHeight;
      }
    });

    this.newMessageSubscription = this.chatService.onMessageReceived$.subscribe((message: MessageResponse) => {

      const fromSelectedUser = this.selectedUser && message.senderId === this.selectedUser.id;

      const fromMeToSelectedUser = this.selectedUser &&
        message.senderId === this.authService.currentUserId &&
        message.receiverId === this.selectedUser.id;

      if (fromSelectedUser || fromMeToSelectedUser) {
        const current = this.chatService.messages$.getValue();
        this.chatService.messages$.next([message, ...current]);
      } else {
        console.log("Отримано фонове повідомлення від:", message.senderId);
      }
    });
  }

  ngOnDestroy(): void {
    this.chatService.stopConnection();
    this.messagesLoadedSubscription?.unsubscribe();
    this.newMessageSubscription?.unsubscribe();
  }

  async selectUser(user: OnlineUser): Promise<void> {
    this.selectedUser = user;
    this.chatService.messages$.next([]);
    this.pageNumber = 1;
    this.hasMoreMessages = true;
    this.isLoading = true;

    try {
      await this.connectionPromise;
      this.chatService.loadMessages(user.id, this.pageNumber);
    } catch (err) {
      console.error("Connection failed, cannot load messages", err);
      this.isLoading = false;
    }
  }

  //onScroll(event: any): void {
  //  if (this.isLoading || !this.hasMoreMessages || !this.selectedUser || !this.messageList) {
  //    return;
  //  }
  //  const el = this.messageList.nativeElement;
  //  const atTop = el.scrollTop <= 10;

  //  if (atTop) {
  //    this.previousScrollHeight = el.scrollHeight;
  //    this.isLoading = true;
  //    this.pageNumber++;
  //    setTimeout(() => {
  //      this.chatService.loadMessages(this.selectedUser!.id, this.pageNumber);
  //    }, 500);
  //  }
  //}

  sendMessage(): void {
    if (!this.selectedUser || !this.messageContent.trim()) {
      return;
    }
    const messageContent = this.messageContent.trim();
    const messageDto: MessageRequest = {
      receiverId: this.selectedUser.id,
      content: messageContent
    };

    this.chatService.sendMessage(messageDto);
    this.messageContent = '';
  }

  onTyping(): void {
    if (!this.selectedUser) return;
    this.chatService.notifyTyping(this.selectedUser.userName);
  }

  logout(): void {
    this.authService.logout();
  }
}
