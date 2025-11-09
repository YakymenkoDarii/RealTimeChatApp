using Microsoft.AspNetCore.Identity;

namespace RealTimeChatApp.Server.Entities
{
    public class AppUser : IdentityUser
    {
        public string? FullName { get; set; }

        public string? ProfileImage { get; set; }
    }
}
