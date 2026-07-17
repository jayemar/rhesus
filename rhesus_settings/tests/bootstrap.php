<?php
/**
 * Bootstrap for PHPUnit tests - stubs for TT-RSS framework dependencies.
 *
 * The feed-icon methods under test (removeFeedIcon, fetchIconFromUrl) only
 * ever touch the database through ORM and the icon cache through DiskCache -
 * both are faked here as simple in-memory stores (reset per-test via
 * ORM::reset()/DiskCache::reset()) so tests run without a real Postgres
 * connection or filesystem access, and can assert on exactly what was
 * stored/removed.
 */

require_once __DIR__ . '/../vendor/autoload.php';

date_default_timezone_set('UTC');

class PluginHost
{
    const HOOK_HEADLINES_CUSTOM_SORT_OVERRIDE = 1;
    const HOOK_FEED_FETCHED = 2;
    const HOOK_RENDER_ARTICLE_API = 3;

    public function add_hook($hook, $plugin, $priority = 10) { return true; }
    public function add_api_method($method, $plugin) { return true; }
    public function get($plugin, $key, $default = null) { return $default; }
    public function set($plugin, $key, $value) { return true; }
}

class Plugin
{
    public function api_version() { return 2; }
}

class Debug
{
    const LOG_VERBOSE = 1;
    const LOG_NORMAL = 0;

    public static function log($msg, $level = 0) {}
}

class Db
{
    public static function pdo()
    {
        throw new \RuntimeException('Real database not available in unit tests - use the ORM/DiskCache fakes instead');
    }
}

// Minimal fake of Idiorm's fluent row/query-builder API, just wide enough
// to cover how removeFeedIcon()/fetchIconFromUrl() use it: for_table()
// ->where([...])->find_one(), and for_table()->find_one($id) (unused by
// these two methods today, but supported for completeness).
class FakeOrmRow
{
    private array $data = [];

    public function __get($name) { return $this->data[$name] ?? null; }
    public function __set($name, $value) { $this->data[$name] = $value; }
    public function __isset($name) { return array_key_exists($name, $this->data); }

    public function set(array $fields): self
    {
        foreach ($fields as $k => $v) $this->data[$k] = $v;
        return $this;
    }

    public function save(): bool { return true; }

    public function toArray(): array { return $this->data; }
}

class ORM
{
    /** @var array<string, FakeOrmRow[]> */
    public static array $tables = [];

    private string $table;
    private array $where = [];

    public static function reset(): void { self::$tables = []; }

    public static function seed(string $table, array $row): FakeOrmRow
    {
        $r = new FakeOrmRow();
        $r->set($row);
        self::$tables[$table][] = $r;
        return $r;
    }

    public static function for_table($table): self
    {
        $o = new self();
        $o->table = $table;
        return $o;
    }

    public function where($conditions): self
    {
        $this->where = is_array($conditions) ? $conditions : [];
        return $this;
    }

    public function find_one($id = null)
    {
        $conditions = $id !== null ? ['id' => $id] : $this->where;
        foreach (self::$tables[$this->table] ?? [] as $row) {
            $match = true;
            foreach ($conditions as $k => $v) {
                if ($row->$k != $v) { $match = false; break; }
            }
            if ($match) return $row;
        }
        return false;
    }
}

class DiskCache
{
    /** @var array<string, array<string, string>> */
    public static array $storage = [];

    private string $namespace;

    public static function reset(): void { self::$storage = []; }

    public static function instance($namespace): self
    {
        $o = new self();
        $o->namespace = $namespace;
        return $o;
    }

    public function exists($key): bool { return isset(self::$storage[$this->namespace][$key]); }
    public function remove($key): bool { unset(self::$storage[$this->namespace][$key]); return true; }
    public function put($key, $content): bool { self::$storage[$this->namespace][$key] = $content; return true; }
    public function get($key) { return self::$storage[$this->namespace][$key] ?? null; }
}

class Config
{
    const MAX_FAVICON_FILE_SIZE = 'MAX_FAVICON_FILE_SIZE';

    /** @var array<string, mixed> */
    public static array $overrides = [];

    public static function reset(): void { self::$overrides = []; }

    public static function get($key)
    {
        if (array_key_exists($key, self::$overrides)) return self::$overrides[$key];
        if ($key === self::MAX_FAVICON_FILE_SIZE) return 1048576;
        return null;
    }
}

class UrlHelper
{
    public static $next_result = false;
    public static string $fetch_last_error = 'mock fetch error';

    public static function reset(): void
    {
        self::$next_result = false;
        self::$fetch_last_error = 'mock fetch error';
    }

    public static function fetch(array $opts)
    {
        return self::$next_result;
    }
}

function truncate_string($str, $len, $suffix = '')
{
    return mb_strlen($str) > $len ? mb_substr($str, 0, $len) . $suffix : $str;
}

function clean($str) { return $str; }

function __($str) { return $str; }

require_once __DIR__ . '/../init.php';
