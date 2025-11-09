namespace RealTimeChatApp.Server.Services
{
    public interface ITokenService
    {
        string GenerateToken(string userId, string userName);
    }
}