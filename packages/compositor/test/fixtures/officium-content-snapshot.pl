#!/usr/bin/env perl
use strict;
use warnings;
no warnings 'once';
use utf8;
use Cwd qw(abs_path);
use File::Basename qw(dirname);
use JSON::PP;
use URI::Escape qw(uri_escape);

BEGIN {
  no warnings 'redefine';
  *CORE::GLOBAL::exit = sub { die "__EXIT__\n"; };
}

my ($version, $date, $hour, $lang1, $lang2) = @ARGV;
$lang1 ||= 'Latin';
$lang2 ||= 'English';

if (!defined $version || !defined $date || !defined $hour) {
  die "usage: officium-content-snapshot.pl <version> <MM-DD-YYYY> <Hour> [lang1] [lang2]\n";
}

my $script_dir = dirname(abs_path(__FILE__));
my $officium = abs_path("$script_dir/../../../../upstream/web/cgi-bin/horas/officium.pl");
if (!defined $officium || !-f $officium) {
  die "cannot locate officium.pl from $script_dir\n";
}

my $query = join('&',
  "command=pray$hour",
  "date=$date",
  'version=' . uri_escape($version),
  'lang1=' . uri_escape($lang1),
  'lang2=' . uri_escape($lang2),
  'votive=',
  'testmode=1',
  'content=1'
);

local $ENV{REQUEST_METHOD} = 'GET';
local $ENV{QUERY_STRING} = $query;
local $0 = $officium;

my $stdout = '';
{
  local *STDOUT;
  open STDOUT, '>', \$stdout or die "cannot capture stdout: $!";
  local $SIG{__WARN__} = sub { };
  my $ok = eval { do $officium; 1 };
  if (!$ok) {
    my $err = $@ || $! || 'unknown error';
    die $err unless $err =~ /__EXIT__/;
  }
}

binmode(STDOUT, ':utf8');

my $payload = {
  winner => $main::winner,
  commemoratio => $main::commemoratio,
  dayname => [@main::dayname],
  rank => $main::rank,
  hour => $hour,
  version => $main::version,
  language1 => $lang1,
  language2 => $lang2,
  units1 => collect_units($lang1, $lang2),
  units2 => collect_units($lang2, $lang1),
};

print JSON::PP->new->canonical->encode($payload), "\n";

sub collect_units {
  my ($lang, $other_lang) = @_;

  local $main::column = 1;
  local $main::expandind = 0;

  main::load_languages_data($lang, $other_lang, $main::langfb, $main::version, $main::missa);
  main::precedence();

  my @script = main::getordinarium($lang, $main::hora);
  @script = main::specials(\@script, $lang);

  my $index = 0;
  my @units = ();
  while (1) {
    my ($unit, $next_index) = main::getunit(\@script, $index);
    last if !defined $unit || $unit eq '';
    $index = $next_index;

    my $html = main::resolve_refs($unit, $lang);
    next if !defined $html || $html eq '';

    push @units, {
      rawFirstLine => first_nonempty_line($unit),
      html => $html
    };
  }

  return \@units;
}

sub first_nonempty_line {
  my ($unit) = @_;
  foreach my $line (split(/\n/, $unit // '')) {
    next if !defined $line;
    next if $line =~ /^\s*$/;
    return $line;
  }
  return '';
}
