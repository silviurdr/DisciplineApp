using DisciplineApp.Api.Data;
using DisciplineApp.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddScoped<TaskMovementService>();

// Add Entity Framework
// In Program.cs
builder.Services.AddDbContext<DisciplineDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Add services
builder.Services.AddScoped<WeeklyScheduleService>();
builder.Services.AddScoped<DataMigrationService>();
builder.Services.AddScoped<FlexibleTaskService>();
builder.Services.AddScoped<TaskMovementService>();
builder.Services.AddHostedService<DailyTaskMovementService>();
builder.Services.AddScoped<IDailyStatsService, DailyStatsService>();
builder.Services.AddHostedService<DailyStatsBackgroundService>();


// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowAngular");
app.UseAuthorization();
app.MapControllers();

// Initialize database and seed habits
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<DisciplineDbContext>();

    try
    {
        context.Database.EnsureCreated();
        await DisciplineApp.Api.Services.HabitSeedData.SeedHabitsAsync(context);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Database initialization error: {ex.Message}");
    }
}

app.Run();