# Anti-Patterns

Common pitfalls and anti-patterns to avoid when building systems and working with AI agents.

## Code Anti-Patterns

### God Object
**Problem**: A single class or module that knows too much or does too much.
**Solution**: Break into smaller, focused components with single responsibilities.

### Spaghetti Code
**Problem**: Code with complex and tangled control structures.
**Solution**: Refactor into clear, linear flows with well-defined functions.

### Copy-Paste Programming
**Problem**: Duplicating code instead of creating reusable abstractions.
**Solution**: Extract common functionality into shared functions or modules.

### Magic Numbers
**Problem**: Using hardcoded values without explanation.
**Solution**: Use named constants with descriptive names.

### Premature Optimization
**Problem**: Optimizing before understanding actual performance needs.
**Solution**: Make it work first, measure, then optimize where needed.

## Architecture Anti-Patterns

### Big Ball of Mud
**Problem**: System lacks clear architecture or organization.
**Solution**: Establish clear architectural patterns and boundaries.

### Golden Hammer
**Problem**: Using the same solution for every problem.
**Solution**: Evaluate each problem independently and choose appropriate solutions.

### Vendor Lock-in
**Problem**: Over-dependence on specific vendor or technology.
**Solution**: Use abstractions and standard interfaces where possible.

### Analysis Paralysis
**Problem**: Over-analyzing without making progress.
**Solution**: Make incremental decisions, iterate, and refine.

## AI Agent Anti-Patterns

### Over-Prompting
**Problem**: Providing too much unnecessary information.
**Solution**: Be concise and focused on relevant context.

### Under-Specifying
**Problem**: Being too vague about requirements.
**Solution**: Provide clear, specific requirements with examples.

### Ignoring Feedback
**Problem**: Not reviewing or acting on agent suggestions.
**Solution**: Carefully review output and provide feedback.

### No Validation
**Problem**: Accepting generated code without testing.
**Solution**: Always validate, test, and review generated code.

### Context Overload
**Problem**: Trying to solve too many things at once.
**Solution**: Break into smaller, focused tasks.

## Process Anti-Patterns

### No Documentation
**Problem**: Changes made without documentation.
**Solution**: Document decisions, especially architectural ones.

### Skip Testing
**Problem**: Deploying without adequate testing.
**Solution**: Write and run tests before deploying.

### Ignoring Warnings
**Problem**: Dismissing compiler or linter warnings.
**Solution**: Address warnings or explicitly suppress with justification.

## Best Practices to Avoid Anti-Patterns

1. **Code Reviews**: Regular peer reviews catch issues early
2. **Testing**: Comprehensive test coverage prevents regressions
3. **Documentation**: Keep documentation up-to-date
4. **Refactoring**: Regular refactoring prevents technical debt
5. **Learning**: Stay informed about best practices
6. **Measurement**: Use metrics to identify problems
7. **Iteration**: Continuously improve processes and code
