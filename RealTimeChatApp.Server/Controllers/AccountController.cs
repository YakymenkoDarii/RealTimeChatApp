using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealTimeChatApp.Server.DTOs;
using RealTimeChatApp.Server.Entities;
using RealTimeChatApp.Server.Extensions;
using RealTimeChatApp.Server.Services;

namespace RealTimeChatApp.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AccountController : ControllerBase
    {
        private readonly UserManager<AppUser> _userManager;
        private readonly ITokenService _tokenService;

        public AccountController(UserManager<AppUser> userManager, ITokenService tokenService)
        {
            _userManager = userManager;
            _tokenService = tokenService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromForm] string fullname, [FromForm] string email, [FromForm] string userName, [FromForm] string password, [FromForm] IFormFile? profileImage)
        {
            var context = this.HttpContext;
            var userFromDb = await _userManager.FindByEmailAsync(email);

            if (userFromDb != null)
            {
                return this.BadRequest("User already exists");
            }

            string picture;

            if (profileImage is null)
            {
                picture = $"{context.Request.Scheme}://{context.Request.Host}/images/default.png";
            }
            else
            {
                var uploadedFileName = await FileUpload.Upload(profileImage);
                picture = $"{context.Request.Scheme}://{context.Request.Host}/uploads/{uploadedFileName}";
            }
        

            AppUser appUser = new AppUser
            {
                Email = email,
                FullName = fullname,
                UserName = userName,
                ProfileImage = picture
            };

            var result = await _userManager.CreateAsync(appUser, password);

            if (!result.Succeeded)
            {
                return this.BadRequest(result.Errors.Select(x => x.Description).FirstOrDefault());
            }

            return this.Ok(result);
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginDto dto)
        {
            if (dto == null)
            {
                return this.BadRequest("Invalid login details");
            }

            var user = await _userManager.FindByEmailAsync(dto.Email);

            if (user == null)
            {
                return this.BadRequest("User not found");
            }

            var result = await _userManager.CheckPasswordAsync(user!, dto.Password);

            if (!result)
            {
                return this.BadRequest("Wrong password");
            }

            var token = _tokenService.GenerateToken(user.Id, user.UserName);

            return this.Ok(new { token = token });
        }

        [HttpGet("me")]
        public async Task<IActionResult> Me()
        {
            var currentLoggedInUserId = this.HttpContext.User.GetUserId();

            var currentLoggedInUser = await _userManager.Users.SingleOrDefaultAsync(x => x.Id == currentLoggedInUserId.ToString());

            return this.Ok(currentLoggedInUser);
        }
    }
}
