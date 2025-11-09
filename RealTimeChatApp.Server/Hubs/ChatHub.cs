using Azure.AI.TextAnalytics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using RealTimeChatApp.Server.DbContext;
using RealTimeChatApp.Server.DTOs;
using RealTimeChatApp.Server.Entities;
using RealTimeChatApp.Server.Extensions;
using System.Collections.Concurrent;
using System.Numerics;

namespace RealTimeChatApp.Server.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        UserManager<AppUser> _userManager;
        AppDbContext _context;
        TextAnalyticsClient _analyticsClient;

        public static readonly ConcurrentDictionary<string, OnlineUserDto> onlineUsers = new();
        public ChatHub(UserManager<AppUser> userManager, AppDbContext context, TextAnalyticsClient analyticsClient) 
        {
            _userManager = userManager;
            _context = context;
            _analyticsClient = analyticsClient;
        }

        public override async Task OnConnectedAsync()
        {
            var httpContext = this.Context.GetHttpContext();
            var receiverId = httpContext?.Request.Query["senderId"].ToString();
            var userName = this.Context.User!.Identity!.Name;
            var currentUser = await _userManager.FindByNameAsync(userName);
            var connectionId = this.Context.ConnectionId;
            
            if (onlineUsers.ContainsKey(userName))
            {
                onlineUsers[userName].ConnectionId = connectionId;
            }
            else
            {
                var user = new OnlineUserDto
                {
                    ConnectionId = connectionId,
                    UserName = userName,
                    ProfilePicture = currentUser!.ProfileImage,
                    FullName = currentUser!.FullName,
                };

                onlineUsers.TryAdd(userName, user);

                await this.Clients.AllExcept(connectionId).SendAsync("Notify", currentUser);
            }

            if (!string.IsNullOrEmpty(receiverId))
            {
                await LoadMessages(receiverId);
            }

            await this.Clients.All.SendAsync("OnlineUsers", await GetAllUsers());
        }

        public async Task SendMessage(MessageRequestDto message)
        {
            var senderId = Context.User!.Identity!.Name;
            var recepientId = message.ReceiverId;
            
            string sentiment = "neutral";
            try
            {
                // Викликаємо Azure API
                DocumentSentiment documentSentiment = await _analyticsClient
                    .AnalyzeSentimentAsync(message.Content);

                sentiment = documentSentiment.Sentiment.ToString().ToLower();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Помилка аналізу сентименту: {ex.Message}");
            }
            var newMessage = new ChatMessage
            {
                Sender = await _userManager.FindByNameAsync(senderId!),
                Receiver = await _userManager.FindByIdAsync(recepientId!),
                IsRead = false,
                CreatedDate = DateTime.UtcNow,
                Content = message.Content,
                Sentiment = sentiment
            };

            _context.ChatMessages.Add(newMessage);
            await _context.SaveChangesAsync();

            await Clients.User(recepientId!).SendAsync("ReceiveMessage", newMessage);
            await Clients.Caller.SendAsync("ReceiveMessage", newMessage);

        }

        public async Task NotifyTyping(string recepientUserName)
        {
            var senderUserName = this.Context.User!.Identity!.Name;

            if (senderUserName == null)
            {
                return;
            }

            var connectionId = onlineUsers.Values.FirstOrDefault(x => x.UserName == recepientUserName)?.ConnectionId;

            if (connectionId != null)
            {
                await Clients.Client(connectionId).SendAsync("NotifyTypingToUser", senderUserName);
            }

        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userName = this.Context.User!.Identity!.Name;
            onlineUsers.TryRemove(userName!, out _);
            await Clients.All.SendAsync("OnlineUsers", await this.GetAllUsers());
        }

        public async Task LoadMessages(string recepientId, int pageNumber = 1)
        {
            int pageSize = 10;
            var userName = this.Context.User!.Identity!.Name;
            var currentUser = await _userManager.FindByNameAsync(userName);

            if (currentUser == null)
            {
                return;
            }

            List<MessageResponseDto> messages = await _context.ChatMessages
                .Where(x => x.ReceiverId == currentUser!.Id && x.SenderId == recepientId || x.SenderId == currentUser!.Id && x.ReceiverId == recepientId)
                .OrderByDescending(x => x.CreatedDate)
                .Select(x => new MessageResponseDto
                {
                    Id = x.Id,
                    Content = x.Content,
                    CreatedDate = x.CreatedDate,
                    ReceiverId = x.ReceiverId,
                    SenderId = x.SenderId,
                    Sentiment = x.Sentiment,
                })
                .ToListAsync();

            foreach (var message in messages)
            {
                var msg = await _context.ChatMessages.FirstOrDefaultAsync(x => x.Id == message.Id);

                if (msg != null && msg.ReceiverId == currentUser!.Id)
                {
                    msg.IsRead = true;
                    await _context.SaveChangesAsync();
                }
            }

            await this.Clients.User(currentUser.Id)
                .SendAsync("ReceiveMessageList", messages);
        }

        private async Task<IEnumerable<OnlineUserDto>> GetAllUsers()
        {
            var userName = this.Context.User!.GetUserName();

            var onlineUsersSet = new HashSet<string>(onlineUsers.Keys);

            var users = await _userManager.Users.Select(u => new OnlineUserDto
            {
                Id = u.Id,
                UserName = u.UserName,
                FullName = u.FullName,
                ProfilePicture = u.ProfileImage,
                IsOnline = onlineUsersSet.Contains(u.UserName!),
                UnreadCount = _context.ChatMessages.Count(x => x.ReceiverId == userName && x.SenderId == u.Id && !x.IsRead)
            }).OrderByDescending(u => u.IsOnline)
            .ToListAsync();

            return users;
        }
    }
}
