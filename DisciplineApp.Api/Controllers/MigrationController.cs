using DisciplineApp.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace DisciplineApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MigrationController : ControllerBase
    {
        private readonly IDataMigrationService _migrationService;
        private readonly ILogger<MigrationController> _logger;

        public MigrationController(IDataMigrationService migrationService, ILogger<MigrationController> logger)
        {
            _migrationService = migrationService;
            _logger = logger;
        }

        /// <summary>
        /// Migrate existing data to new habit tracking system
        /// </summary>
        [HttpPost("migrate-data")]
        public async Task<ActionResult> MigrateData()
        {
            try
            {
                _logger.LogInformation("Starting data migration process");
                await _migrationService.MigrateExistingDataAsync();
                return Ok(new { message = "Data migration completed successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during data migration");
                return StatusCode(500, new { error = "Migration failed", details = ex.Message });
            }
        }

        /// <summary>
        /// Set up initial habits only (without migrating existing data)
        /// </summary>
        [HttpPost("setup-habits")]
        public async Task<ActionResult> SetupHabits()
        {
            try
            {
                _logger.LogInformation("Setting up initial habits");
                await _migrationService.SetupHabitsAsync();
                return Ok(new { message = "Initial habits created successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error setting up habits");
                return StatusCode(500, new { error = "Setup failed", details = ex.Message });
            }
        }
    }
}